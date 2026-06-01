package com.somaticbuilding.aiassistant.application;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.util.ArrayList;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

@Component
public class VideoVisualAnalysisService {
  private final boolean enabled;
  private final String apiKey;
  private final String endpoint;
  private final String model;
  private final int maxFrames;
  private final int timeoutSeconds;
  private final ObjectMapper objectMapper;
  private final HttpClient httpClient;

  public VideoVisualAnalysisService(
    ObjectProvider<ObjectMapper> objectMapperProvider,
    @Value("${integration.content-extractor.visual.enabled:true}") boolean enabled,
    @Value("${integration.content-extractor.visual.endpoint:https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions}") String endpoint,
    @Value("${integration.content-extractor.visual.model:qwen-vl-plus}") String model,
    @Value("${integration.content-extractor.visual.api-key:${spring.ai.openai.api-key:}}") String apiKey,
    @Value("${integration.content-extractor.visual.max-frames:8}") int maxFrames,
    @Value("${integration.content-extractor.visual.timeout-seconds:90}") int timeoutSeconds
  ) {
    this.enabled = enabled;
    this.endpoint = normalizeString(endpoint);
    this.model = normalizeString(model);
    this.apiKey = normalizeString(apiKey);
    this.maxFrames = Math.max(1, Math.min(12, maxFrames));
    this.timeoutSeconds = Math.max(20, timeoutSeconds);
    this.objectMapper = objectMapperProvider.getIfAvailable(ObjectMapper::new);
    this.httpClient = HttpClient.newBuilder()
      .connectTimeout(Duration.ofSeconds(Math.min(20, this.timeoutSeconds)))
      .build();
  }

  public VisualAnalysisResult analyze(List<VideoFrameExtractionService.FrameAsset> frames) {
    return analyze(frames, "");
  }

  public VisualAnalysisResult analyze(
    List<VideoFrameExtractionService.FrameAsset> frames,
    String contextText
  ) {
    if (!enabled) {
      return VisualAnalysisResult.empty("visual_analysis_disabled");
    }
    if (endpoint.isEmpty() || model.isEmpty() || apiKey.isEmpty()) {
      return VisualAnalysisResult.empty("visual_analysis_config_missing");
    }
    List<VideoFrameExtractionService.FrameAsset> selectedFrames = selectFrames(frames);
    if (selectedFrames.isEmpty()) {
      return VisualAnalysisResult.empty("visual_analysis_no_frames");
    }

    try {
      Map<String, Object> payload = buildRequestPayload(selectedFrames, contextText);
      HttpResponse<String> response = postPayload(payload);
      if ((response.statusCode() == 400 || response.statusCode() == 422) && payload.remove("response_format") != null) {
        response = postPayload(payload);
      }
      if (response.statusCode() < 200 || response.statusCode() >= 300) {
        return VisualAnalysisResult.empty("visual_analysis_http_" + response.statusCode() + ":" + truncate(response.body(), 320));
      }
      String content = extractAssistantContent(response.body());
      List<MovementObservation> observations = parseObservations(content);
      if (observations.isEmpty()) {
        VisualAnalysisResult result = VisualAnalysisResult.empty("visual_analysis_empty_observations");
        result.rawContent = content;
        return result;
      }
      VisualAnalysisResult result = new VisualAnalysisResult(observations);
      result.rawContent = content;
      return result;
    } catch (Exception ex) {
      return VisualAnalysisResult.empty("visual_analysis_exception:" + ex.getMessage());
    }
  }

  private HttpResponse<String> postPayload(Map<String, Object> payload) throws IOException, InterruptedException {
    String body = objectMapper.writeValueAsString(payload);
    HttpRequest request = HttpRequest.newBuilder(URI.create(endpoint))
      .timeout(Duration.ofSeconds(timeoutSeconds))
      .header("Authorization", "Bearer " + apiKey)
      .header("Content-Type", "application/json")
      .POST(HttpRequest.BodyPublishers.ofString(body))
      .build();
    return httpClient.send(request, HttpResponse.BodyHandlers.ofString());
  }

  private List<VideoFrameExtractionService.FrameAsset> selectFrames(List<VideoFrameExtractionService.FrameAsset> frames) {
    if (frames == null || frames.isEmpty()) {
      return List.of();
    }
    List<VideoFrameExtractionService.FrameAsset> clean = frames.stream()
      .filter(frame -> frame != null && !normalizeString(frame.getFilePath()).isEmpty() && Files.exists(Path.of(frame.getFilePath())))
      .toList();
    if (clean.size() <= maxFrames) {
      return clean;
    }
    List<VideoFrameExtractionService.FrameAsset> selected = new ArrayList<>();
    double step = (double) clean.size() / (double) maxFrames;
    for (int i = 0; i < maxFrames; i += 1) {
      int index = Math.min(clean.size() - 1, (int) Math.floor(i * step));
      selected.add(clean.get(index));
    }
    return selected;
  }

  private Map<String, Object> buildRequestPayload(
    List<VideoFrameExtractionService.FrameAsset> frames,
    String contextText
  ) throws IOException {
    List<Object> userContent = new ArrayList<>();
    userContent.add(Map.of(
      "type", "text",
      "text", """
Analyze these sampled frames from a fitness/training video.
Return ONLY strict JSON:
{
  "movements": [
    {
      "frame_index": number,
      "start_sec": number,
      "end_sec": number,
      "movement_name": "specific exercise or drill name in English",
      "phase": "warmup|activation|strength|skill|conditioning|mobility|cooldown|unknown",
      "equipment": "bodyweight|barbell|dumbbell|kettlebell|band|machine|other|unknown",
      "body_region": "upper|lower|core|full_body|mobility|unknown",
      "sets": number,
      "reps": number,
      "time_seconds": number,
      "confidence": number,
      "evidence": "short visible evidence"
    }
  ]
}
Rules:
- Identify only visible or strongly implied movements from the frames.
- Do not invent a full workout. Do not add warmup/cooldown unless visible.
- Use the supplied title/caption/transcript context only to disambiguate visible actions and equipment.
- Preserve the video's actual movement order and merge adjacent frames that show the same continuous movement.
- Prefer common exercise names such as Push-Up, Pull-Up, Bench Press, Squat, Lunge, Plank, Jump Rope.
- If the source/context is Chinese, use movement_name as "中文名 / English Name" when you can identify both names.
- If a frame is unclear, omit it or use confidence below 55.
- Keep movement_name concrete; never output generic names like exercise, movement, workout, training.
"""
    ));
    String safeContext = truncate(normalizeString(contextText), 1600);
    if (!safeContext.isEmpty()) {
      userContent.add(Map.of(
        "type", "text",
        "text", "Source context from title/caption/transcript for disambiguation only:\n" + safeContext
      ));
    }
    for (VideoFrameExtractionService.FrameAsset frame : frames) {
      String dataUrl = toImageDataUrl(frame.getFilePath());
      userContent.add(Map.of(
        "type", "text",
        "text", "Frame index=" + frame.getIndex() + ", approx_sec=" +
          (frame.getApproxSec() == null ? "" : frame.getApproxSec().toPlainString())
      ));
      userContent.add(Map.of(
        "type", "image_url",
        "image_url", Map.of(
          "url", dataUrl,
          "detail", "low"
        )
      ));
    }

    Map<String, Object> payload = new LinkedHashMap<>();
    payload.put("model", model);
    payload.put("temperature", 0.1);
    payload.put("max_tokens", 1800);
    payload.put("response_format", Map.of("type", "json_object"));
    payload.put("messages", List.of(
      Map.of(
        "role", "system",
        "content", "You are a precise sports video analyst. Extract visible exercise movements from sampled frames. Return strict JSON only."
      ),
      Map.of(
        "role", "user",
        "content", userContent
      )
    ));
    return payload;
  }

  private String toImageDataUrl(String filePath) throws IOException {
    byte[] bytes = Files.readAllBytes(Path.of(filePath));
    String base64 = Base64.getEncoder().encodeToString(bytes);
    return "data:image/jpeg;base64," + base64;
  }

  private String extractAssistantContent(String rawResponse) throws IOException {
    JsonNode root = objectMapper.readTree(rawResponse);
    JsonNode choices = root.path("choices");
    if (!choices.isArray() || choices.isEmpty()) {
      return "";
    }
    return choices.get(0).path("message").path("content").asText("");
  }

  private List<MovementObservation> parseObservations(String content) throws IOException {
    String json = extractJsonObject(content);
    if (json.isBlank()) {
      return List.of();
    }
    JsonNode root = objectMapper.readTree(json);
    JsonNode movementsNode = root.path("movements");
    if (!movementsNode.isArray()) {
      return List.of();
    }
    List<MovementObservation> observations = new ArrayList<>();
    for (JsonNode node : movementsNode) {
      String movementName = normalizeString(readText(node, "movement_name", "movementName", "name"));
      if (movementName.isEmpty() || isGenericMovementName(movementName)) {
        continue;
      }
      BigDecimal confidence = readDecimal(node, "confidence").setScale(2, RoundingMode.HALF_UP);
      if (confidence.compareTo(BigDecimal.valueOf(45)) < 0) {
        continue;
      }
      observations.add(new MovementObservation(
        node.path("frame_index").asInt(0),
        readDecimal(node, "start_sec", "startSec"),
        readDecimal(node, "end_sec", "endSec"),
        movementName,
        normalizeString(readText(node, "phase")),
        normalizeString(readText(node, "equipment")),
        normalizeString(readText(node, "body_region", "bodyRegion")),
        Math.max(0, node.path("sets").asInt(0)),
        Math.max(0, node.path("reps").asInt(0)),
        Math.max(0, node.path("time_seconds").asInt(0)),
        confidence,
        normalizeString(readText(node, "evidence"))
      ));
    }
    return observations;
  }

  private String extractJsonObject(String content) {
    String safe = normalizeString(content);
    if (safe.isEmpty()) {
      return "";
    }
    int start = safe.indexOf('{');
    int end = safe.lastIndexOf('}');
    if (start < 0 || end <= start) {
      return "";
    }
    return safe.substring(start, end + 1);
  }

  private String readText(JsonNode node, String... keys) {
    if (node == null || keys == null) {
      return "";
    }
    for (String key : keys) {
      JsonNode value = node.get(key);
      if (value != null && value.isValueNode()) {
        String text = normalizeString(value.asText(""));
        if (!text.isEmpty()) {
          return text;
        }
      }
    }
    return "";
  }

  private BigDecimal readDecimal(JsonNode node, String... keys) {
    if (node == null || keys == null) {
      return BigDecimal.ZERO;
    }
    for (String key : keys) {
      JsonNode value = node.get(key);
      if (value == null || value.isNull()) {
        continue;
      }
      if (value.isNumber()) {
        return BigDecimal.valueOf(value.asDouble()).setScale(2, RoundingMode.HALF_UP);
      }
      try {
        return new BigDecimal(value.asText("0").trim()).setScale(2, RoundingMode.HALF_UP);
      } catch (Exception ignored) {
        // try next key
      }
    }
    return BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP);
  }

  private boolean isGenericMovementName(String name) {
    String normalized = normalizeString(name).toLowerCase(Locale.ROOT);
    return normalized.isEmpty()
      || normalized.equals("exercise")
      || normalized.equals("movement")
      || normalized.equals("workout")
      || normalized.equals("training")
      || normalized.equals("fitness")
      || normalized.equals("unknown");
  }

  private String truncate(String value, int max) {
    if (value == null) {
      return "";
    }
    return value.length() <= max ? value : value.substring(0, max);
  }

  private String normalizeString(String value) {
    return value == null ? "" : value.trim();
  }

  public static class VisualAnalysisResult {
    private final List<MovementObservation> observations;
    private final List<String> warnings = new ArrayList<>();
    private String rawContent = "";

    public static VisualAnalysisResult empty(String warning) {
      VisualAnalysisResult result = new VisualAnalysisResult(List.of());
      if (warning != null && !warning.isBlank()) {
        result.warnings.add(warning.trim());
      }
      return result;
    }

    public VisualAnalysisResult(List<MovementObservation> observations) {
      this.observations = observations == null ? List.of() : observations;
    }

    public boolean hasObservations() {
      return !observations.isEmpty();
    }

    public List<MovementObservation> getObservations() {
      return observations;
    }

    public List<String> getWarnings() {
      return warnings;
    }

    public String getRawContent() {
      return rawContent;
    }
  }

  public static class MovementObservation {
    private final int frameIndex;
    private final BigDecimal startSec;
    private final BigDecimal endSec;
    private final String movementName;
    private final String phase;
    private final String equipment;
    private final String bodyRegion;
    private final int sets;
    private final int reps;
    private final int timeSeconds;
    private final BigDecimal confidence;
    private final String evidence;

    public MovementObservation(
      int frameIndex,
      BigDecimal startSec,
      BigDecimal endSec,
      String movementName,
      String phase,
      String equipment,
      String bodyRegion,
      int sets,
      int reps,
      int timeSeconds,
      BigDecimal confidence,
      String evidence
    ) {
      this.frameIndex = frameIndex;
      this.startSec = startSec == null ? BigDecimal.ZERO : startSec;
      this.endSec = endSec == null ? BigDecimal.ZERO : endSec;
      this.movementName = movementName == null ? "" : movementName.trim();
      this.phase = phase == null ? "" : phase.trim();
      this.equipment = equipment == null ? "" : equipment.trim();
      this.bodyRegion = bodyRegion == null ? "" : bodyRegion.trim();
      this.sets = sets;
      this.reps = reps;
      this.timeSeconds = timeSeconds;
      this.confidence = confidence == null ? BigDecimal.ZERO : confidence;
      this.evidence = evidence == null ? "" : evidence.trim();
    }

    public int getFrameIndex() {
      return frameIndex;
    }

    public BigDecimal getStartSec() {
      return startSec;
    }

    public BigDecimal getEndSec() {
      return endSec;
    }

    public String getMovementName() {
      return movementName;
    }

    public String getPhase() {
      return phase;
    }

    public String getEquipment() {
      return equipment;
    }

    public String getBodyRegion() {
      return bodyRegion;
    }

    public int getSets() {
      return sets;
    }

    public int getReps() {
      return reps;
    }

    public int getTimeSeconds() {
      return timeSeconds;
    }

    public BigDecimal getConfidence() {
      return confidence;
    }

    public String getEvidence() {
      return evidence;
    }
  }
}
