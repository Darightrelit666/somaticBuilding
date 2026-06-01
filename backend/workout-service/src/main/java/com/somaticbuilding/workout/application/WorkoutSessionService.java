package com.somaticbuilding.workout.application;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.somaticbuilding.workout.domain.TemplateExercise;
import com.somaticbuilding.workout.domain.WorkoutBlock;
import com.somaticbuilding.workout.domain.WorkoutExercise;
import com.somaticbuilding.workout.domain.WorkoutGroup;
import com.somaticbuilding.workout.domain.WorkoutSession;
import com.somaticbuilding.workout.domain.WorkoutTemplate;
import com.somaticbuilding.workout.infrastructure.mapper.TemplateExerciseMapper;
import com.somaticbuilding.workout.infrastructure.mapper.WorkoutBlockMapper;
import com.somaticbuilding.workout.infrastructure.mapper.WorkoutExerciseMapper;
import com.somaticbuilding.workout.infrastructure.mapper.WorkoutGroupMapper;
import com.somaticbuilding.workout.infrastructure.mapper.WorkoutSessionMapper;
import com.somaticbuilding.workout.infrastructure.mapper.WorkoutTemplateMapper;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Objects;
import java.util.stream.Collectors;

@Service
public class WorkoutSessionService {
  private static final String TEMPLATE_KIND_MODULE = "module";
  private static final String TEMPLATE_KIND_COURSE = "course";
  private static final String TEMPLATE_KIND_ALL = "all";
  private static final String MODULE_PREFIX = "module::";
  private static final String COURSE_PREFIX = "course::";
  private static final String BASE62_ALPHABET = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
  private static final int BASE62_RADIX = BASE62_ALPHABET.length();

  private final WorkoutSessionMapper workoutSessionMapper;
  private final WorkoutBlockMapper workoutBlockMapper;
  private final WorkoutGroupMapper workoutGroupMapper;
  private final WorkoutExerciseMapper workoutExerciseMapper;
  private final WorkoutTemplateMapper workoutTemplateMapper;
  private final TemplateExerciseMapper templateExerciseMapper;

  public WorkoutSessionService(
    WorkoutSessionMapper workoutSessionMapper,
    WorkoutBlockMapper workoutBlockMapper,
    WorkoutGroupMapper workoutGroupMapper,
    WorkoutExerciseMapper workoutExerciseMapper,
    WorkoutTemplateMapper workoutTemplateMapper,
    TemplateExerciseMapper templateExerciseMapper
  ) {
    this.workoutSessionMapper = workoutSessionMapper;
    this.workoutBlockMapper = workoutBlockMapper;
    this.workoutGroupMapper = workoutGroupMapper;
    this.workoutExerciseMapper = workoutExerciseMapper;
    this.workoutTemplateMapper = workoutTemplateMapper;
    this.templateExerciseMapper = templateExerciseMapper;
  }

  @Transactional
  public WorkoutSession createSession(Long userId, String sessionName, String trainingStyle, List<String> blockNames, Long templateId) {
    LocalDateTime now = LocalDateTime.now();
    List<String> normalized = normalizeBlocks(blockNames);
    if (normalized.isEmpty()) {
      normalized = defaultBlocks(trainingStyle);
    }
    if (normalized.isEmpty()) {
      normalized = List.of("Warmup", "Strength", "Cooldown");
    }
    WorkoutSession session = new WorkoutSession();
    session.setUserId(userId);
    session.setSessionName(sessionName);
    session.setTrainingStyle(trainingStyle);
    session.setSourceTemplateId(templateId);
    session.setStatus(1);
    session.setIsDeleted(0);
    session.setCreateTime(now);
    session.setUpdateTime(now);
    workoutSessionMapper.insert(session);

    int index = 1;
    for (String name : normalized) {
      WorkoutBlock block = new WorkoutBlock();
      block.setSessionId(session.getId());
      block.setBlockName(name);
      block.setOrderIndex(index++);
      block.setStatus(1);
      block.setIsDeleted(0);
      block.setCreateTime(now);
      block.setUpdateTime(now);
      workoutBlockMapper.insert(block);
    }
    return session;
  }

  public WorkoutSession getSession(Long sessionId) {
    return workoutSessionMapper.selectOne(
      new LambdaQueryWrapper<WorkoutSession>()
        .eq(WorkoutSession::getId, sessionId)
        .eq(WorkoutSession::getIsDeleted, 0)
    );
  }

  public List<WorkoutBlock> listBlocks(Long sessionId) {
    return workoutBlockMapper.selectList(
      new LambdaQueryWrapper<WorkoutBlock>()
        .eq(WorkoutBlock::getSessionId, sessionId)
        .eq(WorkoutBlock::getIsDeleted, 0)
        .orderByAsc(WorkoutBlock::getOrderIndex)
    );
  }

  public List<WorkoutGroup> listGroups(List<Long> blockIds) {
    if (blockIds == null || blockIds.isEmpty()) {
      return new ArrayList<>();
    }
    return workoutGroupMapper.selectList(
      new LambdaQueryWrapper<WorkoutGroup>()
        .in(WorkoutGroup::getBlockId, blockIds)
        .eq(WorkoutGroup::getIsDeleted, 0)
        .orderByAsc(WorkoutGroup::getOrderIndex)
    );
  }

  public List<WorkoutExercise> listExercises(List<Long> groupIds) {
    if (groupIds == null || groupIds.isEmpty()) {
      return new ArrayList<>();
    }
    return workoutExerciseMapper.selectList(
      new LambdaQueryWrapper<WorkoutExercise>()
        .in(WorkoutExercise::getGroupId, groupIds)
        .eq(WorkoutExercise::getIsDeleted, 0)
        .orderByAsc(WorkoutExercise::getOrderIndex)
    );
  }

  @Transactional
  public void updateSession(Long sessionId, String sessionName, String trainingStyle) {
    WorkoutSession existing = getSession(sessionId);
    if (existing == null) {
      throw new IllegalArgumentException("Session not found.");
    }
    WorkoutSession patch = new WorkoutSession();
    patch.setId(existing.getId());
    patch.setSessionName(sessionName);
    patch.setTrainingStyle(trainingStyle);
    patch.setUpdateTime(LocalDateTime.now());
    workoutSessionMapper.updateById(patch);
  }

  @Transactional
  public WorkoutGroup addGroup(Long blockId, String groupType, Integer orderIndex) {
    WorkoutBlock block = workoutBlockMapper.selectById(blockId);
    if (block == null || !Objects.equals(block.getIsDeleted(), 0)) {
      throw new IllegalArgumentException("Block not found.");
    }
    LocalDateTime now = LocalDateTime.now();
    WorkoutGroup group = new WorkoutGroup();
    group.setBlockId(blockId);
    group.setGroupType(groupType);
    group.setOrderIndex(orderIndex);
    group.setStatus(1);
    group.setIsDeleted(0);
    group.setCreateTime(now);
    group.setUpdateTime(now);
    workoutGroupMapper.insert(group);
    return group;
  }

  @Transactional
  public WorkoutExercise addExercise(WorkoutExercise payload) {
    WorkoutGroup group = workoutGroupMapper.selectById(payload.getGroupId());
    if (group == null || !Objects.equals(group.getIsDeleted(), 0)) {
      throw new IllegalArgumentException("Group not found.");
    }
    LocalDateTime now = LocalDateTime.now();
    payload.setStatus(1);
    payload.setIsDeleted(0);
    payload.setCreateTime(now);
    payload.setUpdateTime(now);
    workoutExerciseMapper.insert(payload);
    return payload;
  }

  @Transactional
  public void removeExercise(Long exerciseId) {
    WorkoutExercise existing = workoutExerciseMapper.selectById(exerciseId);
    if (existing == null || !Objects.equals(existing.getIsDeleted(), 0)) {
      throw new IllegalArgumentException("Exercise not found.");
    }
    WorkoutExercise patch = new WorkoutExercise();
    patch.setId(existing.getId());
    patch.setIsDeleted(1);
    patch.setUpdateTime(LocalDateTime.now());
    workoutExerciseMapper.updateById(patch);
  }

  public List<String> normalizeBlocks(List<String> names) {
    if (names == null) {
      return new ArrayList<>();
    }
    return names.stream()
      .filter(Objects::nonNull)
      .map(String::trim)
      .filter(value -> !value.isEmpty())
      .collect(Collectors.toList());
  }

  public List<String> defaultBlocks(String trainingStyle) {
    if (trainingStyle == null) {
      return new ArrayList<>();
    }
    String key = trainingStyle.trim().toLowerCase();
    if (key.equals("strength & conditioning")) {
      return List.of("Warmup", "Activation", "Power", "Strength", "Accessory", "Conditioning", "Cooldown");
    }
    if (key.equals("bodybuilding")) {
      return List.of("Warmup", "Compound", "Secondary", "Isolation", "Pump", "Cooldown");
    }
    if (key.equals("crossfit")) {
      return List.of("Warmup", "Skill", "Strength", "WOD", "Cooldown");
    }
    if (key.equals("functional training") || key.equals("functional")) {
      return List.of("Warmup", "Movement Prep", "Strength", "Circuit", "Finisher", "Cooldown");
    }
    if (key.equals("mobility / yoga") || key.equals("mobility") || key.equals("yoga")) {
      return List.of("Breathing", "Mobility", "Flow", "Stretch", "Relax");
    }
    if (key.equals("athletic training") || key.equals("athletic")) {
      return List.of("Warmup", "Speed", "Agility", "Power", "Strength", "Conditioning", "Cooldown");
    }
    if (key.equals("rehab")) {
      return List.of("Assessment", "Activation", "Corrective", "Strength", "Mobility");
    }
    return new ArrayList<>();
  }

  public List<WorkoutTemplate> listTemplates(Long userId, String templateKind) {
    String normalizedKind = normalizeTemplateKind(templateKind);
    List<WorkoutTemplate> templates = workoutTemplateMapper.selectList(
      new LambdaQueryWrapper<WorkoutTemplate>()
        .eq(WorkoutTemplate::getUserId, userId)
        .eq(WorkoutTemplate::getIsDeleted, 0)
        .orderByDesc(WorkoutTemplate::getCreateTime)
    );
    if (TEMPLATE_KIND_ALL.equals(normalizedKind)) {
      return templates;
    }
    return templates.stream()
      .filter(item -> normalizedKind.equals(resolveTemplateKind(item.getTemplateName())))
      .collect(Collectors.toList());
  }

  public WorkoutTemplate getTemplate(Long templateId) {
    return workoutTemplateMapper.selectOne(
      new LambdaQueryWrapper<WorkoutTemplate>()
        .eq(WorkoutTemplate::getId, templateId)
        .eq(WorkoutTemplate::getIsDeleted, 0)
    );
  }

  public List<TemplateExercise> listTemplateExercises(Long templateId) {
    return templateExerciseMapper.selectList(
      new LambdaQueryWrapper<TemplateExercise>()
        .eq(TemplateExercise::getTemplateId, templateId)
        .eq(TemplateExercise::getIsDeleted, 0)
        .orderByAsc(TemplateExercise::getOrderIndex)
    );
  }

  @Transactional
  public WorkoutTemplate createTemplate(
    Long userId,
    String templateName,
    String templateKind,
    List<TemplateExercise> exercises
  ) {
    LocalDateTime now = LocalDateTime.now();
    WorkoutTemplate template = new WorkoutTemplate();
    template.setUserId(userId);
    template.setTemplateName(encodeTemplateName(templateName, templateKind));
    template.setStatus(1);
    template.setIsDeleted(0);
    template.setCreateTime(now);
    template.setUpdateTime(now);
    workoutTemplateMapper.insert(template);

    int order = 1;
    if (exercises != null) {
      for (TemplateExercise exercise : exercises) {
        if (exercise == null || exercise.getExerciseId() == null) {
          continue;
        }
        exercise.setTemplateId(template.getId());
        if (exercise.getOrderIndex() == null) {
          exercise.setOrderIndex(order++);
        }
        exercise.setIsDeleted(0);
        exercise.setCreateTime(now);
        exercise.setUpdateTime(now);
        templateExerciseMapper.insert(exercise);
      }
    }
    return template;
  }

  @Transactional
  public void updateTemplate(
    Long templateId,
    String templateName,
    String templateKind,
    List<TemplateExercise> exercises
  ) {
    WorkoutTemplate existing = getTemplate(templateId);
    if (existing == null) {
      throw new IllegalArgumentException("Template not found.");
    }
    String nextDisplayName =
      (templateName == null || templateName.trim().isEmpty())
        ? decodeTemplateName(existing.getTemplateName())
        : templateName;
    String nextKind =
      (templateKind == null || templateKind.trim().isEmpty())
        ? resolveTemplateKind(existing.getTemplateName())
        : templateKind;

    WorkoutTemplate patch = new WorkoutTemplate();
    patch.setId(existing.getId());
    patch.setTemplateName(encodeTemplateName(nextDisplayName, nextKind));
    patch.setUpdateTime(LocalDateTime.now());
    workoutTemplateMapper.updateById(patch);

    if (exercises == null) {
      return;
    }

    LocalDateTime now = LocalDateTime.now();
    List<TemplateExercise> existingExercises = listTemplateExercises(templateId);
    for (TemplateExercise existingExercise : existingExercises) {
      TemplateExercise softDeletePatch = new TemplateExercise();
      softDeletePatch.setId(existingExercise.getId());
      softDeletePatch.setIsDeleted(1);
      softDeletePatch.setUpdateTime(now);
      templateExerciseMapper.updateById(softDeletePatch);
    }

    int order = 1;
    for (TemplateExercise exercise : exercises) {
      if (exercise == null || exercise.getExerciseId() == null) {
        continue;
      }
      exercise.setTemplateId(templateId);
      if (exercise.getOrderIndex() == null) {
        exercise.setOrderIndex(order++);
      }
      exercise.setIsDeleted(0);
      exercise.setCreateTime(now);
      exercise.setUpdateTime(now);
      templateExerciseMapper.insert(exercise);
    }
  }

  @Transactional
  public void deleteTemplate(Long templateId) {
    WorkoutTemplate template = workoutTemplateMapper.selectById(templateId);
    if (template == null || template.getIsDeleted() == null || template.getIsDeleted() == 1) {
      throw new IllegalArgumentException("Template not found.");
    }
    WorkoutTemplate patch = new WorkoutTemplate();
    patch.setId(templateId);
    patch.setIsDeleted(1);
    patch.setUpdateTime(LocalDateTime.now());
    workoutTemplateMapper.updateById(patch);
  }

  public String getTemplateDisplayName(WorkoutTemplate template) {
    return decodeTemplateName(template == null ? null : template.getTemplateName());
  }

  public String getTemplateKind(WorkoutTemplate template) {
    return resolveTemplateKind(template == null ? null : template.getTemplateName());
  }

  public String getTemplateShareCode(WorkoutTemplate template) {
    if (template == null) {
      throw new IllegalArgumentException("Template not found.");
    }
    return toTemplateShareCode(template.getId());
  }

  public String toTemplateShareCode(Long templateId) {
    if (templateId == null || templateId <= 0) {
      throw new IllegalArgumentException("Invalid template id.");
    }
    long value = templateId;
    StringBuilder builder = new StringBuilder();
    while (value > 0) {
      int index = (int) (value % BASE62_RADIX);
      builder.append(BASE62_ALPHABET.charAt(index));
      value = value / BASE62_RADIX;
    }
    return builder.reverse().toString();
  }

  public Long fromTemplateShareCode(String shareCode) {
    if (shareCode == null || shareCode.trim().isEmpty()) {
      throw new IllegalArgumentException("Share code is required.");
    }
    String normalized = shareCode.trim();
    long value = 0L;
    for (int i = 0; i < normalized.length(); i += 1) {
      char current = normalized.charAt(i);
      int index = BASE62_ALPHABET.indexOf(current);
      if (index < 0) {
        throw new IllegalArgumentException("Invalid share code.");
      }
      value = Math.multiplyExact(value, BASE62_RADIX);
      value = Math.addExact(value, index);
    }
    if (value <= 0) {
      throw new IllegalArgumentException("Invalid share code.");
    }
    return value;
  }

  public WorkoutTemplate getTemplateByShareCode(String shareCode) {
    try {
      Long templateId = fromTemplateShareCode(shareCode);
      return getTemplate(templateId);
    } catch (IllegalArgumentException | ArithmeticException ex) {
      return null;
    }
  }

  public String normalizeTemplateKind(String kind) {
    if (kind == null) {
      return TEMPLATE_KIND_COURSE;
    }
    String normalized = kind.trim().toLowerCase(Locale.ROOT);
    if (TEMPLATE_KIND_MODULE.equals(normalized)) {
      return TEMPLATE_KIND_MODULE;
    }
    if (TEMPLATE_KIND_ALL.equals(normalized)) {
      return TEMPLATE_KIND_ALL;
    }
    return TEMPLATE_KIND_COURSE;
  }

  private String encodeTemplateName(String templateName, String templateKind) {
    String displayName =
      templateName == null || templateName.trim().isEmpty() ? "Untitled Template" : templateName.trim();
    String cleanName = stripInternalPrefix(displayName);
    String normalizedKind = normalizeTemplateKind(templateKind);
    if (TEMPLATE_KIND_MODULE.equals(normalizedKind)) {
      return MODULE_PREFIX + cleanName;
    }
    return COURSE_PREFIX + cleanName;
  }

  private String decodeTemplateName(String storedName) {
    if (storedName == null || storedName.trim().isEmpty()) {
      return "Untitled Template";
    }
    String trimmed = storedName.trim();
    if (trimmed.startsWith(MODULE_PREFIX)) {
      return trimmed.substring(MODULE_PREFIX.length());
    }
    if (trimmed.startsWith(COURSE_PREFIX)) {
      return trimmed.substring(COURSE_PREFIX.length());
    }
    return trimmed;
  }

  private String resolveTemplateKind(String storedName) {
    if (storedName == null) {
      return TEMPLATE_KIND_COURSE;
    }
    String trimmed = storedName.trim().toLowerCase(Locale.ROOT);
    if (trimmed.startsWith(MODULE_PREFIX)) {
      return TEMPLATE_KIND_MODULE;
    }
    if (trimmed.startsWith(COURSE_PREFIX)) {
      return TEMPLATE_KIND_COURSE;
    }
    return TEMPLATE_KIND_COURSE;
  }

  private String stripInternalPrefix(String rawName) {
    if (rawName == null) {
      return "";
    }
    String lowered = rawName.toLowerCase(Locale.ROOT);
    if (lowered.startsWith(MODULE_PREFIX)) {
      return rawName.substring(MODULE_PREFIX.length());
    }
    if (lowered.startsWith(COURSE_PREFIX)) {
      return rawName.substring(COURSE_PREFIX.length());
    }
    return rawName;
  }
}
