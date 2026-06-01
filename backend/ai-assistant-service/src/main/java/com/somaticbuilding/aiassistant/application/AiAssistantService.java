package com.somaticbuilding.aiassistant.application;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.somaticbuilding.aiassistant.domain.AssistantMessage;
import com.somaticbuilding.aiassistant.domain.AssistantSession;
import com.somaticbuilding.aiassistant.infrastructure.mapper.AssistantMessageMapper;
import com.somaticbuilding.aiassistant.infrastructure.mapper.AssistantSessionMapper;
import com.somaticbuilding.aiassistant.interfaces.dto.GoalSynthesisResponse;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

@Service
public class AiAssistantService {
  private static final List<String> RADAR_ORDER = List.of(
    "Mobility",
    "Stability",
    "Control",
    "Strength",
    "Power",
    "Endurance"
  );

  private static final List<String> TARGET_ORDER = List.of(
    "Hypertrophy",
    "Neural Adaptation",
    "Injury Rehab",
    "Metabolic Stress"
  );

  private final AssistantSessionMapper sessionMapper;
  private final AssistantMessageMapper messageMapper;
  private final ChatClient chatClient;
  private final ObjectMapper objectMapper;
  private final RagKnowledgeService ragKnowledgeService;

  public AiAssistantService(
    AssistantSessionMapper sessionMapper,
    AssistantMessageMapper messageMapper,
    ObjectProvider<ChatClient.Builder> chatClientBuilderProvider,
    ObjectProvider<ObjectMapper> objectMapperProvider,
    RagKnowledgeService ragKnowledgeService
  ) {
    this.sessionMapper = sessionMapper;
    this.messageMapper = messageMapper;
    ChatClient.Builder builder = chatClientBuilderProvider.getIfAvailable();
    this.chatClient = builder == null ? null : builder.build();
    this.objectMapper = objectMapperProvider.getIfAvailable(ObjectMapper::new);
    this.ragKnowledgeService = ragKnowledgeService;
  }

  @Transactional
  public AssistantSession createSession(Long userId, String title) {
    LocalDateTime now = LocalDateTime.now();
    AssistantSession session = new AssistantSession();
    session.setUserId(userId);
    session.setTitle(title);
    session.setStatus(1);
    session.setIsDeleted(0);
    session.setCreateTime(now);
    session.setUpdateTime(now);
    sessionMapper.insert(session);
    return session;
  }

  public AssistantSession getSession(Long id) {
    return sessionMapper.selectOne(
      new LambdaQueryWrapper<AssistantSession>()
        .eq(AssistantSession::getId, id)
        .eq(AssistantSession::getIsDeleted, 0)
    );
  }

  public List<AssistantMessage> listMessages(Long sessionId) {
    return messageMapper.selectList(
      new LambdaQueryWrapper<AssistantMessage>()
        .eq(AssistantMessage::getSessionId, sessionId)
        .eq(AssistantMessage::getIsDeleted, 0)
        .orderByAsc(AssistantMessage::getId)
    );
  }

  @Transactional
  public AssistantMessage saveMessage(Long sessionId, String role, String content) {
    LocalDateTime now = LocalDateTime.now();
    AssistantMessage message = new AssistantMessage();
    message.setSessionId(sessionId);
    message.setRole(role);
    message.setContent(content);
    message.setStatus(1);
    message.setIsDeleted(0);
    message.setCreateTime(now);
    message.setUpdateTime(now);
    messageMapper.insert(message);
    return message;
  }

  @Transactional
  public AssistantMessage chat(Long sessionId, String userMessage) {
    return chat(sessionId, userMessage, null);
  }

  @Transactional
  public AssistantMessage chat(Long sessionId, String userMessage, String mode) {
    saveMessage(sessionId, "user", userMessage);
    String reply = generateReply(userMessage, mode);
    return saveMessage(sessionId, "assistant", reply);
  }

  public GoalSynthesisResponse goalSynthesis(Long userId, String goalInput, String lifestyleProfile) {
    String normalizedGoal = goalInput == null ? "" : goalInput.trim();
    if (normalizedGoal.isEmpty()) {
      throw new IllegalArgumentException("Goal input cannot be empty.");
    }

    GoalSynthesisResponse fallback = buildFallbackGoalSynthesis(normalizedGoal, lifestyleProfile);
    if (chatClient == null) {
      return fallback;
    }

    try {
      String systemPrompt =
        "You are SomaticBuilding AI coach.\n"
          + "Return ONLY JSON, no markdown.\n"
          + "JSON schema:\n"
          + "{\n"
          + "  \"summary\": \"short sentence\",\n"
          + "  \"recommendation\": \"short coaching instruction\",\n"
          + "  \"radar\": {\n"
          + "    \"mobility\": 0-100,\n"
          + "    \"stability\": 0-100,\n"
          + "    \"control\": 0-100,\n"
          + "    \"strength\": 0-100,\n"
          + "    \"power\": 0-100,\n"
          + "    \"endurance\": 0-100\n"
          + "  },\n"
          + "  \"targets\": {\n"
          + "    \"hypertrophy\": 0-100,\n"
          + "    \"neural_adaptation\": 0-100,\n"
          + "    \"injury_rehab\": 0-100,\n"
          + "    \"metabolic_stress\": 0-100\n"
          + "  }\n"
          + "}";
      String responseText = chatClient
        .prompt()
        .system(systemPrompt)
        .user(buildGoalSynthesisPrompt(userId, normalizedGoal, lifestyleProfile))
        .call()
        .content();
      return parseGoalSynthesisResponse(responseText, fallback);
    } catch (Exception ex) {
      return fallback;
    }
  }

  private String generateReply(String userMessage, String mode) {
    if (shouldUseRag(mode) && ragKnowledgeService != null && ragKnowledgeService.isReady()) {
      return generateRagReply(userMessage);
    }

    if (chatClient == null) {
      return "AI provider is not configured yet.";
    }
    try {
      String content = chatClient
        .prompt()
        .system(
          "You are SomaticBuilding AI coach. Reply with clear, concise, practical training guidance."
        )
        .user(userMessage)
        .call()
        .content();
      if (content == null || content.isBlank()) {
        return "AI response was empty. Please try again.";
      }
      return content.trim();
    } catch (Exception ex) {
      return "AI provider request failed. Please verify model endpoint and API key.";
    }
  }

  private String generateRagReply(String userMessage) {
    List<RagKnowledgeService.RagMatch> matches =
      ragKnowledgeService.search(userMessage, ragKnowledgeService.getDefaultTopK());
    boolean chinese = containsCjk(userMessage);
    if (matches.isEmpty()) {
      return ragKnowledgeService.renderFallbackAnswer(userMessage, chinese, matches);
    }
    if (chatClient == null) {
      return ragKnowledgeService.renderFallbackAnswer(userMessage, chinese, matches);
    }

    String context = ragKnowledgeService.renderPromptContext(matches);
    try {
      String content = chatClient
        .prompt()
        .system(
          "You are SomaticBuilding AI coach.\n"
            + "Answer with clear, concise, practical training guidance.\n"
            + "Use the retrieved local knowledge context when it is relevant.\n"
            + "Do not invent medical diagnoses. If the context is insufficient, state the limitation and give conservative training advice.\n"
            + "When you rely on retrieved context, cite the bracket labels such as [R1] or [R2]."
        )
        .user(
          "User question:\n"
            + userMessage
            + "\n\nRetrieved local knowledge context:\n"
            + context
            + "\n\nTask:\n"
            + "Answer the user question based on the context above. Keep the answer actionable and safe."
        )
        .call()
        .content();
      if (content == null || content.isBlank()) {
        return ragKnowledgeService.renderFallbackAnswer(userMessage, chinese, matches);
      }
      return content.trim();
    } catch (Exception ex) {
      return ragKnowledgeService.renderFallbackAnswer(userMessage, chinese, matches);
    }
  }

  private boolean shouldUseRag(String mode) {
    String normalized = mode == null ? "" : mode.trim().toLowerCase(Locale.ROOT);
    return normalized.isEmpty() || "qa".equals(normalized) || "rag".equals(normalized);
  }

  private boolean containsCjk(String text) {
    if (text == null || text.isBlank()) return false;
    for (int i = 0; i < text.length(); i += 1) {
      char ch = text.charAt(i);
      if (ch >= 0x4e00 && ch <= 0x9fff) {
        return true;
      }
    }
    return false;
  }

  private String buildGoalSynthesisPrompt(Long userId, String goalInput, String lifestyleProfile) {
    String profile = lifestyleProfile == null ? "" : lifestyleProfile.trim();
    return String.format(
      "User ID: %d%n"
        + "Goal Input: %s%n"
        + "Lifestyle Profile: %s%n%n"
        + "Task:%n"
        + "1) Synthesize a concise performance direction.%n"
        + "2) Return balanced scores (0-100) for radar and target weights.%n"
        + "3) Keep recommendation practical and conservative if injury history is mentioned.",
      userId == null ? 0L : userId,
      goalInput,
      profile.isEmpty() ? "N/A" : profile
    );
  }

  private GoalSynthesisResponse parseGoalSynthesisResponse(
    String content,
    GoalSynthesisResponse fallback
  ) {
    if (content == null || content.isBlank()) {
      return fallback;
    }

    try {
      String jsonSegment = extractJsonObject(content.trim());
      JsonNode root = objectMapper.readTree(jsonSegment);
      return mergeGoalSynthesis(root, fallback);
    } catch (Exception ex) {
      return fallback;
    }
  }

  private String extractJsonObject(String raw) {
    int start = raw.indexOf('{');
    int end = raw.lastIndexOf('}');
    if (start < 0 || end <= start) {
      throw new IllegalArgumentException("No JSON object found in AI response.");
    }
    return raw.substring(start, end + 1);
  }

  private GoalSynthesisResponse mergeGoalSynthesis(JsonNode root, GoalSynthesisResponse fallback) {
    GoalSynthesisResponse merged = new GoalSynthesisResponse();
    merged.setSummary(firstText(root, fallback.getSummary(), "summary", "overview", "analysis"));
    merged.setRecommendation(
      firstText(root, fallback.getRecommendation(), "recommendation", "focus", "coaching")
    );

    Map<String, Integer> radarScores = radarMapFromResponse(fallback);
    applyRadarNode(root.get("radar"), radarScores);
    applyRadarNode(root.get("radar_scores"), radarScores);
    applyRadarNode(root, radarScores);
    merged.setRadar(buildRadarMetrics(radarScores));

    Map<String, Integer> targetScores = targetMapFromResponse(fallback);
    applyTargetNode(root.get("targets"), targetScores);
    applyTargetNode(root.get("weights"), targetScores);
    applyTargetNode(root, targetScores);
    merged.setTargets(buildGoalTargets(targetScores));

    return merged;
  }

  private String firstText(JsonNode root, String fallback, String... keys) {
    for (String key : keys) {
      JsonNode node = root == null ? null : root.get(key);
      if (node != null && node.isTextual()) {
        String text = node.asText("").trim();
        if (!text.isEmpty()) {
          return text;
        }
      }
    }
    return fallback;
  }

  private Map<String, Integer> radarMapFromResponse(GoalSynthesisResponse response) {
    Map<String, Integer> map = new LinkedHashMap<>();
    for (String subject : RADAR_ORDER) {
      map.put(subject, 60);
    }
    if (response == null || response.getRadar() == null) {
      return map;
    }
    for (GoalSynthesisResponse.RadarMetric item : response.getRadar()) {
      if (item == null) continue;
      String subject = normalizeRadarLabel(item.getSubject());
      if (subject == null) continue;
      map.put(subject, clampScore(item.getScore()));
    }
    return map;
  }

  private Map<String, Integer> targetMapFromResponse(GoalSynthesisResponse response) {
    Map<String, Integer> map = new LinkedHashMap<>();
    for (String label : TARGET_ORDER) {
      map.put(label, 50);
    }
    if (response == null || response.getTargets() == null) {
      return map;
    }
    for (GoalSynthesisResponse.GoalTarget item : response.getTargets()) {
      if (item == null) continue;
      String label = normalizeTargetLabel(item.getLabel());
      if (label == null) continue;
      map.put(label, clampScore(item.getScore()));
    }
    return map;
  }

  private void applyRadarNode(JsonNode node, Map<String, Integer> radarScores) {
    if (node == null || node.isNull()) return;
    if (node.isArray()) {
      for (JsonNode item : node) {
        if (item == null || !item.isObject()) continue;
        String key = textFrom(item, "subject", "label", "name", "key");
        String normalized = normalizeRadarLabel(key);
        Integer score = readScore(item);
        if (normalized != null && score != null) {
          radarScores.put(normalized, clampScore(score));
        }
      }
      return;
    }

    if (node.isObject()) {
      node.fields().forEachRemaining(entry -> {
        String normalized = normalizeRadarLabel(entry.getKey());
        Integer score = readScore(entry.getValue());
        if (normalized != null && score != null) {
          radarScores.put(normalized, clampScore(score));
        }
      });
    }
  }

  private void applyTargetNode(JsonNode node, Map<String, Integer> targetScores) {
    if (node == null || node.isNull()) return;
    if (node.isArray()) {
      for (JsonNode item : node) {
        if (item == null || !item.isObject()) continue;
        String key = textFrom(item, "label", "name", "subject", "key");
        String normalized = normalizeTargetLabel(key);
        Integer score = readScore(item);
        if (normalized != null && score != null) {
          targetScores.put(normalized, clampScore(score));
        }
      }
      return;
    }

    if (node.isObject()) {
      node.fields().forEachRemaining(entry -> {
        String normalized = normalizeTargetLabel(entry.getKey());
        Integer score = readScore(entry.getValue());
        if (normalized != null && score != null) {
          targetScores.put(normalized, clampScore(score));
        }
      });
    }
  }

  private Integer readScore(JsonNode node) {
    if (node == null || node.isNull()) return null;
    if (node.isNumber()) return clampScore(node.asInt());
    if (node.isTextual()) {
      return parseScoreText(node.asText(""));
    }
    if (node.isObject()) {
      Integer direct = firstNumeric(node, "score", "value", "weight", "a", "A");
      if (direct != null) return direct;
      String levelText = textFrom(node, "level", "priority");
      Integer fromLevel = levelToScore(levelText);
      if (fromLevel != null) return fromLevel;
    }
    return null;
  }

  private Integer firstNumeric(JsonNode node, String... keys) {
    for (String key : keys) {
      JsonNode value = node.get(key);
      if (value == null || value.isNull()) continue;
      if (value.isNumber()) return clampScore(value.asInt());
      if (value.isTextual()) {
        Integer parsed = parseScoreText(value.asText(""));
        if (parsed != null) return parsed;
      }
    }
    return null;
  }

  private String textFrom(JsonNode node, String... keys) {
    if (node == null) return "";
    for (String key : keys) {
      JsonNode value = node.get(key);
      if (value == null || !value.isTextual()) continue;
      String text = value.asText("").trim();
      if (!text.isEmpty()) return text;
    }
    return "";
  }

  private Integer parseScoreText(String value) {
    if (value == null) return null;
    String trimmed = value.trim();
    if (trimmed.isEmpty()) return null;
    try {
      return clampScore(Integer.parseInt(trimmed));
    } catch (NumberFormatException ignored) {
      return levelToScore(trimmed);
    }
  }

  private Integer levelToScore(String value) {
    if (value == null) return null;
    String normalized = value.trim().toLowerCase(Locale.ROOT);
    if (normalized.isEmpty()) return null;
    if (normalized.contains("high")) return 82;
    if (normalized.contains("med")) return 58;
    if (normalized.contains("low")) return 32;
    return null;
  }

  private String normalizeRadarLabel(String raw) {
    if (raw == null || raw.isBlank()) return null;
    String key = normalizeKey(raw);
    if (key.contains("mobility") || key.contains("flexibility")) return "Mobility";
    if (key.contains("stability") || key.contains("balance")) return "Stability";
    if (key.contains("control") || key.contains("coordination")) return "Control";
    if (key.contains("strength")) return "Strength";
    if (key.contains("power") || key.contains("explosive")) return "Power";
    if (key.contains("endurance") || key.contains("metabolic") || key.contains("cardio")) {
      return "Endurance";
    }
    return null;
  }

  private String normalizeTargetLabel(String raw) {
    if (raw == null || raw.isBlank()) return null;
    String key = normalizeKey(raw);
    if (key.contains("hypertrophy") || key.contains("muscle")) return "Hypertrophy";
    if (key.contains("neural") || key.contains("adaptation") || key.contains("skill")) {
      return "Neural Adaptation";
    }
    if (key.contains("injury") || key.contains("rehab") || key.contains("recovery")) {
      return "Injury Rehab";
    }
    if (key.contains("metabolic") || key.contains("conditioning") || key.contains("fatloss")) {
      return "Metabolic Stress";
    }
    return null;
  }

  private String normalizeKey(String raw) {
    return raw.toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9]", "");
  }

  private GoalSynthesisResponse buildFallbackGoalSynthesis(String goalInput, String lifestyleProfile) {
    String mergedText = (goalInput + " " + (lifestyleProfile == null ? "" : lifestyleProfile))
      .toLowerCase(Locale.ROOT);
    boolean hasInjuryContext = containsAny(
      mergedText,
      "injury",
      "rehab",
      "pain",
      "history",
      "突出",
      "损伤",
      "疼"
    );

    Map<String, Integer> radar = new LinkedHashMap<>();
    radar.put("Mobility", 64);
    radar.put("Stability", 60);
    radar.put("Control", 62);
    radar.put("Strength", 58);
    radar.put("Power", 56);
    radar.put("Endurance", 60);

    if (containsAny(mergedText, "strength", "powerlifting", "squat", "bench", "deadlift", "三大项")) {
      addScore(radar, "Strength", 14);
      addScore(radar, "Power", 9);
      addScore(radar, "Control", 5);
    }
    if (containsAny(mergedText, "hypertrophy", "muscle", "build", "增肌")) {
      addScore(radar, "Strength", 12);
      addScore(radar, "Endurance", 8);
    }
    if (containsAny(mergedText, "endurance", "cardio", "marathon", "conditioning", "减脂")) {
      addScore(radar, "Endurance", 14);
      addScore(radar, "Stability", 4);
    }
    if (containsAny(mergedText, "jump", "sprint", "explosive", "power", "爆发")) {
      addScore(radar, "Power", 14);
      addScore(radar, "Control", 7);
    }
    if (containsAny(mergedText, "mobility", "flexibility", "range of motion", "灵活", "柔韧")) {
      addScore(radar, "Mobility", 12);
      addScore(radar, "Control", 5);
    }
    if (containsAny(mergedText, "advanced", "elite")) {
      addScore(radar, "Strength", 4);
      addScore(radar, "Power", 4);
      addScore(radar, "Control", 3);
    }
    if (containsAny(mergedText, "beginner", "novice")) {
      addScore(radar, "Mobility", 6);
      addScore(radar, "Stability", 6);
      addScore(radar, "Power", -6);
    }
    if (hasInjuryContext) {
      addScore(radar, "Mobility", 10);
      addScore(radar, "Stability", 10);
      addScore(radar, "Control", 8);
      addScore(radar, "Strength", -6);
      addScore(radar, "Power", -10);
    }

    GoalSynthesisResponse response = new GoalSynthesisResponse();
    response.setRadar(buildRadarMetrics(radar));

    Map<String, Integer> targets = new LinkedHashMap<>();
    targets.put("Hypertrophy", avg(radar.get("Strength"), radar.get("Endurance")));
    targets.put("Neural Adaptation", avg(radar.get("Control"), radar.get("Power")));
    targets.put(
      "Injury Rehab",
      clampScore(avg(radar.get("Mobility"), radar.get("Stability")) + (hasInjuryContext ? 10 : 0))
    );
    targets.put("Metabolic Stress", avg(radar.get("Endurance"), radar.get("Power")));
    response.setTargets(buildGoalTargets(targets));

    List<Map.Entry<String, Integer>> sorted = new ArrayList<>(radar.entrySet());
    sorted.sort(Comparator.comparingInt(Map.Entry<String, Integer>::getValue).reversed());
    String top1 = sorted.get(0).getKey();
    String top2 = sorted.get(1).getKey();
    String low = sorted.get(sorted.size() - 1).getKey();
    String summary = "Primary objective emphasizes %s and %s while monitoring %s."
      .formatted(top1, top2, low);

    String recommendation;
    switch (low) {
      case "Mobility":
        recommendation = "Begin each session with mobility prep and controlled range work before heavy loading.";
        break;
      case "Stability":
        recommendation = "Prioritize unilateral stability and anti-rotation patterns before increasing intensity.";
        break;
      case "Control":
        recommendation = "Use tempo-based reps and strict alignment checkpoints to build movement control.";
        break;
      case "Strength":
        recommendation = "Progress foundational compound lifts gradually with strict technique and volume control.";
        break;
      case "Power":
        recommendation = "Build power through low-volume explosive drills only after quality movement is stable.";
        break;
      default:
        recommendation = "Add aerobic intervals and pace-control sets to improve work capacity and recovery.";
        break;
    }

    if (hasInjuryContext) {
      recommendation = recommendation + " Keep progression conservative and avoid pain-provoking ranges.";
    }

    response.setSummary(summary);
    response.setRecommendation(recommendation);
    return response;
  }

  private List<GoalSynthesisResponse.RadarMetric> buildRadarMetrics(Map<String, Integer> scores) {
    List<GoalSynthesisResponse.RadarMetric> list = new ArrayList<>();
    for (String subject : RADAR_ORDER) {
      GoalSynthesisResponse.RadarMetric metric = new GoalSynthesisResponse.RadarMetric();
      metric.setSubject(subject);
      metric.setScore(clampScore(scores.get(subject)));
      metric.setFullMark(100);
      list.add(metric);
    }
    return list;
  }

  private List<GoalSynthesisResponse.GoalTarget> buildGoalTargets(Map<String, Integer> scores) {
    List<GoalSynthesisResponse.GoalTarget> list = new ArrayList<>();
    for (String label : TARGET_ORDER) {
      int score = clampScore(scores.get(label));
      GoalSynthesisResponse.GoalTarget target = new GoalSynthesisResponse.GoalTarget();
      target.setLabel(label);
      target.setScore(score);
      target.setLevel(scoreToLevel(score));
      list.add(target);
    }
    return list;
  }

  private String scoreToLevel(int score) {
    if (score >= 70) return "High";
    if (score >= 45) return "Med";
    return "Low";
  }

  private int avg(Integer a, Integer b) {
    return clampScore(((a == null ? 0 : a) + (b == null ? 0 : b)) / 2);
  }

  private void addScore(Map<String, Integer> scores, String key, int delta) {
    Integer current = scores.get(key);
    int value = (current == null ? 0 : current) + delta;
    scores.put(key, clampScore(value));
  }

  private boolean containsAny(String source, String... tokens) {
    if (source == null || source.isBlank()) return false;
    for (String token : tokens) {
      if (source.contains(token)) return true;
    }
    return false;
  }

  private int clampScore(Integer value) {
    if (value == null) return 0;
    if (value < 0) return 0;
    return Math.min(value, 100);
  }
}
