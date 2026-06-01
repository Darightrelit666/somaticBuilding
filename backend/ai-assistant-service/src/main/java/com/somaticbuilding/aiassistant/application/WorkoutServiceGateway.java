package com.somaticbuilding.aiassistant.application;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

@Component
public class WorkoutServiceGateway {
  private final RestTemplate restTemplate;
  private final ObjectMapper objectMapper;
  private final String workoutServiceBaseUrl;

  public WorkoutServiceGateway(
    ObjectProvider<ObjectMapper> objectMapperProvider,
    @Value("${integration.workout.base-url:http://localhost:8084}") String workoutServiceBaseUrl
  ) {
    this.restTemplate = new RestTemplate();
    this.objectMapper = objectMapperProvider.getIfAvailable(ObjectMapper::new);
    this.workoutServiceBaseUrl = normalizeBaseUrl(workoutServiceBaseUrl);
  }

  public WorkoutApplyResult applyPlanToWorkout(ApplyPlanRequest request) {
    if (request == null) {
      throw new IllegalArgumentException("Apply plan request cannot be null.");
    }
    if (request.getUserId() == null || request.getUserId() <= 0) {
      throw new IllegalArgumentException("Apply plan requires a valid user id.");
    }

    ParsedPlan plan = parsePlanStructure(request);
    if (plan.blocks.isEmpty()) {
      throw new IllegalArgumentException("Plan structure has no valid blocks.");
    }

    Long sessionId = createWorkoutSession(request.getUserId(), plan.style, plan.title, plan.blocks);
    List<RemoteBlock> remoteBlocks = loadRemoteBlocks(sessionId);
    if (remoteBlocks.size() < plan.blocks.size()) {
      throw new IllegalArgumentException(
        "Workout session block count mismatch after creation. Expected %d, received %d."
          .formatted(plan.blocks.size(), remoteBlocks.size())
      );
    }

    int writtenGroups = 0;
    int writtenExercises = 0;
    for (int blockIndex = 0; blockIndex < plan.blocks.size(); blockIndex += 1) {
      PlanBlock block = plan.blocks.get(blockIndex);
      Long blockId = remoteBlocks.get(blockIndex).id;
      if (blockId == null || blockId <= 0) {
        throw new IllegalArgumentException("Workout block id missing after session creation.");
      }
      for (PlanGroup group : block.groups) {
        Long groupId = createGroup(blockId, group);
        writtenGroups += 1;
        int exerciseOrder = 1;
        for (PlanExercise exercise : group.exercises) {
          createExercise(groupId, exercise, group.rounds, exerciseOrder++);
          writtenExercises += 1;
        }
      }
    }

    Long templateId = null;
    if (request.isSaveTemplate()) {
      templateId = createTemplate(request.getUserId(), plan.planType, plan.title, plan.blocks);
    }

    WorkoutApplyResult result = new WorkoutApplyResult();
    result.setSessionId(sessionId);
    result.setTemplateId(templateId);
    result.setBlockCount(plan.blocks.size());
    result.setGroupCount(writtenGroups);
    result.setExerciseCount(writtenExercises);
    return result;
  }

  private Long createWorkoutSession(
    Long userId,
    String trainingStyle,
    String title,
    List<PlanBlock> blocks
  ) {
    List<String> blockNames = blocks.stream().map(block -> block.blockName).toList();
    Map<String, Object> payload = new LinkedHashMap<>();
    payload.put("userId", userId);
    payload.put("sessionName", title);
    payload.put("trainingStyle", trainingStyle);
    payload.put("blockNames", blockNames);
    payload.put("templateId", null);

    Map<String, Object> data = postForData("/api/v1/workout/session", payload, "create workout session");
    Long sessionId = readLong(data, "id");
    if (sessionId == null || sessionId <= 0) {
      throw new IllegalArgumentException("Workout session create succeeded but session id is missing.");
    }
    return sessionId;
  }

  private List<RemoteBlock> loadRemoteBlocks(Long sessionId) {
    Map<String, Object> data = getForData("/api/v1/workout/session/" + sessionId, "load workout session");
    List<Map<String, Object>> blocks = readObjectList(data.get("blocks"));
    List<RemoteBlock> result = new ArrayList<>();
    for (Map<String, Object> item : blocks) {
      Long id = readLong(item, "id");
      String blockName = readString(item, "blockName", "block_name");
      if (id == null || id <= 0 || blockName.isEmpty()) {
        continue;
      }
      Integer orderIndex = readInt(item, "orderIndex", "order_index");
      result.add(new RemoteBlock(id, blockName, orderIndex == null ? Integer.MAX_VALUE : orderIndex));
    }
    result.sort((a, b) -> Integer.compare(a.orderIndex, b.orderIndex));
    return result;
  }

  private Long createGroup(Long blockId, PlanGroup group) {
    Map<String, Object> payload = new LinkedHashMap<>();
    payload.put("blockId", blockId);
    payload.put("groupType", group.groupType);
    payload.put("orderIndex", group.orderIndex);
    Map<String, Object> data = postForData("/api/v1/workout/group", payload, "create workout group");
    Long groupId = readLong(data, "id");
    if (groupId == null || groupId <= 0) {
      throw new IllegalArgumentException("Workout group create succeeded but group id is missing.");
    }
    return groupId;
  }

  private void createExercise(Long groupId, PlanExercise exercise, int fallbackRounds, int orderIndex) {
    Map<String, Object> payload = new LinkedHashMap<>();
    payload.put("groupId", groupId);
    payload.put("exerciseId", exercise.exerciseId);
    payload.put("sets", exercise.sets);
    payload.put("reps", exercise.reps);
    payload.put("restSeconds", exercise.restSeconds);
    payload.put("timeSeconds", exercise.timeSeconds);
    payload.put("rounds", exercise.rounds > 0 ? exercise.rounds : fallbackRounds);
    payload.put("orderIndex", orderIndex);
    postForData("/api/v1/workout/exercise", payload, "create workout exercise");
  }

  private Long createTemplate(
    Long userId,
    String planType,
    String title,
    List<PlanBlock> blocks
  ) {
    List<Map<String, Object>> exercises = new ArrayList<>();
    int order = 1;
    for (PlanBlock block : blocks) {
      for (PlanGroup group : block.groups) {
        for (PlanExercise exercise : group.exercises) {
          Map<String, Object> row = new LinkedHashMap<>();
          row.put("exerciseId", exercise.exerciseId);
          row.put("sets", exercise.sets);
          row.put("reps", exercise.reps);
          row.put("restSeconds", exercise.restSeconds);
          row.put("timeSeconds", exercise.timeSeconds);
          row.put("rounds", exercise.rounds > 0 ? exercise.rounds : group.rounds);
          row.put("orderIndex", order++);
          exercises.add(row);
        }
      }
    }

    Map<String, Object> payload = new LinkedHashMap<>();
    payload.put("userId", userId);
    payload.put("templateName", title);
    payload.put("templateKind", "module".equals(planType) ? "module" : "course");
    payload.put("exercises", exercises);
    Map<String, Object> data = postForData("/api/v1/workout/template", payload, "create workout template");
    Long templateId = readLong(data, "id");
    if (templateId == null || templateId <= 0) {
      throw new IllegalArgumentException("Workout template create succeeded but template id is missing.");
    }
    return templateId;
  }

  private ParsedPlan parsePlanStructure(ApplyPlanRequest request) {
    Object source = request.getStructure();
    Map<String, Object> root = toObjectMap(source);
    if (root == null) {
      throw new IllegalArgumentException("Plan structure is empty or invalid JSON.");
    }

    String planType = normalizePlanType(readString(root, "plan_type", "planType"), request.getPlanType());
    String style = readString(root, "style");
    if (style.isEmpty()) {
      style = request.getPlanStyle() == null ? "Strength & Conditioning" : request.getPlanStyle().trim();
    }
    String title = readString(root, "title");
    if (title.isEmpty()) {
      title = request.getPlanTitle() == null ? "AI Generated Training Plan" : request.getPlanTitle().trim();
    }

    List<Map<String, Object>> blockMaps = readObjectList(root.get("blocks"));
    List<PlanBlock> blocks = new ArrayList<>();
    int blockOrder = 1;
    for (Map<String, Object> blockMap : blockMaps) {
      String blockName = readString(blockMap, "block_name", "blockName", "title", "name");
      if (blockName.isEmpty()) {
        blockName = "Block " + blockOrder;
      }
      List<Map<String, Object>> groupMaps = readObjectList(blockMap.get("groups"));
      List<PlanGroup> groups = new ArrayList<>();
      int groupOrder = 1;
      for (Map<String, Object> groupMap : groupMaps) {
        String groupType = readString(groupMap, "group_type", "groupType");
        if (groupType.isEmpty()) {
          groupType = "straight_sets";
        }
        Integer rounds = readInt(groupMap, "rounds");
        int safeRounds = rounds == null || rounds <= 0 ? 1 : rounds;

        List<Map<String, Object>> exerciseMaps = readObjectList(groupMap.get("exercises"));
        List<PlanExercise> exercises = new ArrayList<>();
        for (Map<String, Object> exerciseMap : exerciseMaps) {
          Long exerciseId = readLong(exerciseMap, "exercise_id", "exerciseId");
          if (exerciseId == null || exerciseId <= 0) {
            continue;
          }
          int sets = coercePositive(readInt(exerciseMap, "sets"), 1);
          int reps = coercePositive(readInt(exerciseMap, "reps"), 0);
          int restSeconds = coercePositive(readInt(exerciseMap, "rest_seconds", "restSeconds"), 0);
          int timeSeconds = coercePositive(readInt(exerciseMap, "time_seconds", "timeSeconds"), 0);
          int roundsValue = coercePositive(readInt(exerciseMap, "rounds", "rnd"), safeRounds);

          PlanExercise exercise = new PlanExercise(
            exerciseId,
            sets,
            reps,
            restSeconds,
            timeSeconds,
            roundsValue
          );
          exercises.add(exercise);
        }
        if (exercises.isEmpty()) {
          continue;
        }
        groups.add(new PlanGroup(groupType, groupOrder++, safeRounds, exercises));
      }

      if (groups.isEmpty()) {
        continue;
      }
      blocks.add(new PlanBlock(blockName, blockOrder++, groups));
    }

    return new ParsedPlan(planType, style, title, blocks);
  }

  @SuppressWarnings("unchecked")
  private Map<String, Object> toObjectMap(Object value) {
    if (value == null) {
      return null;
    }
    if (value instanceof Map<?, ?> map) {
      return (Map<String, Object>) map;
    }
    if (value instanceof String text) {
      String trimmed = text.trim();
      if (trimmed.isEmpty()) {
        return null;
      }
      try {
        return objectMapper.readValue(trimmed, new TypeReference<>() {});
      } catch (Exception ex) {
        return null;
      }
    }
    return objectMapper.convertValue(value, new TypeReference<>() {});
  }

  private Map<String, Object> postForData(String path, Object payload, String actionName) {
    Object raw;
    try {
      raw = restTemplate.postForObject(workoutServiceBaseUrl + path, payload, Object.class);
    } catch (RestClientException ex) {
      throw new IllegalArgumentException(
        "Workout service request failed while trying to %s: %s".formatted(actionName, ex.getMessage())
      );
    }
    return extractResponseData(raw, actionName);
  }

  private Map<String, Object> getForData(String path, String actionName) {
    Object raw;
    try {
      raw = restTemplate.getForObject(workoutServiceBaseUrl + path, Object.class);
    } catch (RestClientException ex) {
      throw new IllegalArgumentException(
        "Workout service request failed while trying to %s: %s".formatted(actionName, ex.getMessage())
      );
    }
    return extractResponseData(raw, actionName);
  }

  @SuppressWarnings("unchecked")
  private Map<String, Object> extractResponseData(Object raw, String actionName) {
    if (!(raw instanceof Map<?, ?> responseMap)) {
      throw new IllegalArgumentException("Workout service returned invalid response when trying to " + actionName + ".");
    }
    Object codeObj = responseMap.get("code");
    Integer code = toInteger(codeObj);
    if (code == null || (code != 0 && code != 200)) {
      Object messageObj = responseMap.containsKey("message") ? responseMap.get("message") : "Unknown error";
      String message = String.valueOf(messageObj);
      throw new IllegalArgumentException(
        "Workout service rejected request while trying to %s: %s".formatted(actionName, message)
      );
    }
    Object dataObj = responseMap.get("data");
    if (dataObj == null) {
      return new LinkedHashMap<>();
    }
    if (dataObj instanceof Map<?, ?> dataMap) {
      return (Map<String, Object>) dataMap;
    }
    throw new IllegalArgumentException("Workout service data format is invalid while trying to " + actionName + ".");
  }

  @SuppressWarnings("unchecked")
  private List<Map<String, Object>> readObjectList(Object value) {
    List<Map<String, Object>> result = new ArrayList<>();
    if (!(value instanceof List<?> list)) {
      return result;
    }
    for (Object item : list) {
      if (item instanceof Map<?, ?> map) {
        result.add((Map<String, Object>) map);
      }
    }
    return result;
  }

  private String readString(Map<String, Object> source, String... keys) {
    if (source == null || keys == null) {
      return "";
    }
    for (String key : keys) {
      if (key == null || key.isEmpty()) {
        continue;
      }
      Object value = source.get(key);
      if (value instanceof String text && !text.trim().isEmpty()) {
        return text.trim();
      }
    }
    return "";
  }

  private Integer readInt(Map<String, Object> source, String... keys) {
    if (source == null || keys == null) {
      return null;
    }
    for (String key : keys) {
      Object value = source.get(key);
      Integer parsed = toInteger(value);
      if (parsed != null) {
        return parsed;
      }
    }
    return null;
  }

  private Long readLong(Map<String, Object> source, String... keys) {
    if (source == null || keys == null) {
      return null;
    }
    for (String key : keys) {
      Object value = source.get(key);
      Long parsed = toLong(value);
      if (parsed != null) {
        return parsed;
      }
    }
    return null;
  }

  private Integer toInteger(Object value) {
    if (value instanceof Integer i) {
      return i;
    }
    if (value instanceof Number n) {
      return n.intValue();
    }
    if (value instanceof String s) {
      try {
        return Integer.parseInt(s.trim());
      } catch (NumberFormatException ignored) {
        return null;
      }
    }
    return null;
  }

  private Long toLong(Object value) {
    if (value instanceof Long l) {
      return l;
    }
    if (value instanceof Number n) {
      return n.longValue();
    }
    if (value instanceof String s) {
      try {
        return Long.parseLong(s.trim());
      } catch (NumberFormatException ignored) {
        return null;
      }
    }
    return null;
  }

  private int coercePositive(Integer value, int fallback) {
    if (value == null || value < 0) {
      return fallback;
    }
    return value;
  }

  private String normalizeBaseUrl(String raw) {
    String fallback = "http://localhost:8084";
    if (raw == null || raw.trim().isEmpty()) {
      return fallback;
    }
    String value = raw.trim();
    while (value.endsWith("/")) {
      value = value.substring(0, value.length() - 1);
    }
    return value.isEmpty() ? fallback : value;
  }

  private String normalizePlanType(String primary, String fallback) {
    String value = (primary == null ? "" : primary.trim()).toLowerCase(Locale.ROOT);
    if ("module".equals(value)) {
      return "module";
    }
    if ("course".equals(value)) {
      return "course";
    }
    String fallbackValue = (fallback == null ? "" : fallback.trim()).toLowerCase(Locale.ROOT);
    if ("module".equals(fallbackValue)) {
      return "module";
    }
    return "course";
  }

  public static class ApplyPlanRequest {
    private Long userId;
    private String planType;
    private String planStyle;
    private String planTitle;
    private Object structure;
    private boolean saveTemplate;

    public Long getUserId() {
      return userId;
    }

    public void setUserId(Long userId) {
      this.userId = userId;
    }

    public String getPlanType() {
      return planType;
    }

    public void setPlanType(String planType) {
      this.planType = planType;
    }

    public String getPlanStyle() {
      return planStyle;
    }

    public void setPlanStyle(String planStyle) {
      this.planStyle = planStyle;
    }

    public String getPlanTitle() {
      return planTitle;
    }

    public void setPlanTitle(String planTitle) {
      this.planTitle = planTitle;
    }

    public Object getStructure() {
      return structure;
    }

    public void setStructure(Object structure) {
      this.structure = structure;
    }

    public boolean isSaveTemplate() {
      return saveTemplate;
    }

    public void setSaveTemplate(boolean saveTemplate) {
      this.saveTemplate = saveTemplate;
    }
  }

  public static class WorkoutApplyResult {
    private Long sessionId;
    private Long templateId;
    private Integer blockCount;
    private Integer groupCount;
    private Integer exerciseCount;

    public Long getSessionId() {
      return sessionId;
    }

    public void setSessionId(Long sessionId) {
      this.sessionId = sessionId;
    }

    public Long getTemplateId() {
      return templateId;
    }

    public void setTemplateId(Long templateId) {
      this.templateId = templateId;
    }

    public Integer getBlockCount() {
      return blockCount;
    }

    public void setBlockCount(Integer blockCount) {
      this.blockCount = blockCount;
    }

    public Integer getGroupCount() {
      return groupCount;
    }

    public void setGroupCount(Integer groupCount) {
      this.groupCount = groupCount;
    }

    public Integer getExerciseCount() {
      return exerciseCount;
    }

    public void setExerciseCount(Integer exerciseCount) {
      this.exerciseCount = exerciseCount;
    }
  }

  private static class ParsedPlan {
    private final String planType;
    private final String style;
    private final String title;
    private final List<PlanBlock> blocks;

    private ParsedPlan(String planType, String style, String title, List<PlanBlock> blocks) {
      this.planType = planType;
      this.style = style;
      this.title = title;
      this.blocks = blocks;
    }
  }

  private static class PlanBlock {
    private final String blockName;
    private final int orderIndex;
    private final List<PlanGroup> groups;

    private PlanBlock(String blockName, int orderIndex, List<PlanGroup> groups) {
      this.blockName = blockName;
      this.orderIndex = orderIndex;
      this.groups = groups;
    }
  }

  private static class PlanGroup {
    private final String groupType;
    private final int orderIndex;
    private final int rounds;
    private final List<PlanExercise> exercises;

    private PlanGroup(String groupType, int orderIndex, int rounds, List<PlanExercise> exercises) {
      this.groupType = groupType;
      this.orderIndex = orderIndex;
      this.rounds = rounds;
      this.exercises = exercises;
    }
  }

  private static class PlanExercise {
    private final long exerciseId;
    private final int sets;
    private final int reps;
    private final int restSeconds;
    private final int timeSeconds;
    private final int rounds;

    private PlanExercise(long exerciseId, int sets, int reps, int restSeconds, int timeSeconds, int rounds) {
      this.exerciseId = exerciseId;
      this.sets = sets;
      this.reps = reps;
      this.restSeconds = restSeconds;
      this.timeSeconds = timeSeconds;
      this.rounds = rounds;
    }
  }

  private static class RemoteBlock {
    private final Long id;
    private final String blockName;
    private final int orderIndex;

    private RemoteBlock(Long id, String blockName, int orderIndex) {
      this.id = id;
      this.blockName = blockName;
      this.orderIndex = orderIndex;
    }
  }
}
