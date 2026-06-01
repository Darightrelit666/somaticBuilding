package com.somaticbuilding.aiassistant.application;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.somaticbuilding.aiassistant.domain.ContentAnalysisJob;
import com.somaticbuilding.aiassistant.domain.ContentMovementCandidate;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Component;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

@Component
public class ExerciseAutoProvisionService {
  private static final Set<String> EQUIPMENT_KEYWORDS = Set.of(
    "barbell",
    "dumbbell",
    "kettlebell",
    "cable",
    "machine",
    "band"
  );

  private final RestTemplate restTemplate;
  private final ObjectMapper objectMapper;
  private final VideoClipExtractionService videoClipExtractionService;
  private final boolean enabled;
  private final String exerciseServiceBaseUrl;

  public ExerciseAutoProvisionService(
    ObjectProvider<ObjectMapper> objectMapperProvider,
    VideoClipExtractionService videoClipExtractionService,
    @Value("${integration.exercise.auto-provision.enabled:true}") boolean enabled,
    @Value("${integration.exercise.base-url:http://localhost:8083}") String exerciseServiceBaseUrl
  ) {
    this.restTemplate = new RestTemplate();
    this.objectMapper = objectMapperProvider.getIfAvailable(ObjectMapper::new);
    this.videoClipExtractionService = videoClipExtractionService;
    this.enabled = enabled;
    this.exerciseServiceBaseUrl = normalizeBaseUrl(exerciseServiceBaseUrl);
  }

  public ProvisionResult provisionFromCandidate(
    ContentAnalysisJob job,
    ContentMovementCandidate candidate
  ) {
    if (!enabled || job == null || candidate == null) {
      return ProvisionResult.failed("auto_provision_disabled");
    }

    String sourceUrl = normalizeString(job.getSourceUrl());
    String label = firstNonBlank(candidate.getNormalizedLabel(), candidate.getRawLabel());
    if (sourceUrl.isEmpty() || label.isEmpty()) {
      return ProvisionResult.failed("source_or_label_missing");
    }
    if (isUnsafeAutoProvisionLabel(label)) {
      return ProvisionResult.failed("unsafe_candidate_label");
    }

    VideoClipExtractionService.ClipAsset clip = videoClipExtractionService.extract(
      sourceUrl,
      candidate.getStartSec(),
      candidate.getEndSec(),
      label
    );
    String uploadedVideoUrl = "";
    String uploadedCoverUrl = "";
    String provisionNote = "";
    if (clip.hasVideo()) {
      uploadedVideoUrl = uploadMedia(clip.getVideoBytes(), clip.getVideoFileName(), clip.getVideoContentType(), "video");
      if (clip.hasCover()) {
        uploadedCoverUrl = uploadMedia(clip.getCoverBytes(), clip.getCoverFileName(), clip.getCoverContentType(), "image");
      }
      if (uploadedVideoUrl.isEmpty()) {
        provisionNote = "auto_created_without_video_upload";
      }
    } else {
      provisionNote = clip.getWarnings().isEmpty()
        ? "auto_created_without_clip"
        : "auto_created_without_clip:" + String.join(" | ", clip.getWarnings());
    }

    Long exerciseId = createCustomExercise(job, candidate, label, uploadedCoverUrl, uploadedVideoUrl);
    if (exerciseId == null || exerciseId <= 0) {
      return ProvisionResult.failed("create_custom_exercise_failed");
    }

    String finalNote = provisionNote.isEmpty()
      ? "auto_clip_created"
      : provisionNote;
    BigDecimal score = uploadedVideoUrl.isEmpty()
      ? BigDecimal.valueOf(88.00).setScale(2, RoundingMode.HALF_UP)
      : BigDecimal.valueOf(96.00).setScale(2, RoundingMode.HALF_UP);
    return ProvisionResult.succeeded(
      exerciseId,
      score,
      finalNote
    );
  }

  public ProvisionResult provisionFromLabel(
    ContentAnalysisJob job,
    String label,
    String reasonTag
  ) {
    if (!enabled) {
      return ProvisionResult.failed("auto_provision_disabled");
    }
    String safeLabel = normalizeString(label);
    if (safeLabel.isEmpty()) {
      return ProvisionResult.failed("label_missing");
    }
    if (isUnsafeAutoProvisionLabel(safeLabel)) {
      return ProvisionResult.failed("unsafe_label");
    }
    Long exerciseId = createCustomExercise(job, null, safeLabel, "", "");
    if (exerciseId == null || exerciseId <= 0) {
      return ProvisionResult.failed("create_custom_exercise_failed");
    }
    String note = normalizeString(reasonTag).isEmpty() ? "auto_created_from_label" : normalizeString(reasonTag);
    return ProvisionResult.succeeded(
      exerciseId,
      BigDecimal.valueOf(90.00).setScale(2, RoundingMode.HALF_UP),
      note
    );
  }

  private String uploadMedia(byte[] bytes, String fileName, String contentType, String mediaType) {
    if (bytes == null || bytes.length == 0 || fileName == null || fileName.isBlank()) {
      return "";
    }

    HttpHeaders partHeaders = new HttpHeaders();
    partHeaders.setContentType(MediaType.parseMediaType(firstNonBlank(contentType, "application/octet-stream")));
    HttpEntity<ByteArrayResource> filePart = new HttpEntity<>(
      new NamedByteArrayResource(bytes, fileName),
      partHeaders
    );

    MultiValueMap<String, Object> body = new LinkedMultiValueMap<>();
    body.add("file", filePart);
    body.add("mediaType", mediaType);

    HttpHeaders headers = new HttpHeaders();
    headers.setContentType(MediaType.MULTIPART_FORM_DATA);
    HttpEntity<MultiValueMap<String, Object>> requestEntity = new HttpEntity<>(body, headers);

    Map<String, Object> data = postForData(
      "/api/v1/exercise/media/upload",
      requestEntity,
      "upload exercise media"
    );
    return readString(data, "url", "mediaUrl", "media_url");
  }

  private Long createCustomExercise(
    ContentAnalysisJob job,
    ContentMovementCandidate candidate,
    String label,
    String coverUrl,
    String videoUrl
  ) {
    Map<String, Object> payload = new LinkedHashMap<>();
    payload.put("name", trimToLength(label, 128));
    payload.put("primaryMuscle", inferPrimaryMuscle(label));
    payload.put("equipment", inferEquipment(label));
    payload.put("difficulty", 2);
    payload.put("description", buildDescription(job, candidate, label));
    payload.put("coverUrl", normalizeString(coverUrl).isEmpty() ? null : coverUrl);
    payload.put("videoUrl", videoUrl);

    Map<String, Object> data = postForData("/api/v1/exercise/custom", payload, "create custom exercise");
    return readLong(data, "id");
  }

  private String buildDescription(ContentAnalysisJob job, ContentMovementCandidate candidate, String label) {
    String source = normalizeString(job == null ? null : job.getSourceUrl());
    String candidateNote = normalizeString(candidate == null ? null : candidate.getNotes());
    String segment = "";
    if (candidate != null && candidate.getStartSec() != null && candidate.getEndSec() != null) {
      segment = "Segment: %ss-%ss."
        .formatted(
          candidate.getStartSec().setScale(1, RoundingMode.HALF_UP).toPlainString(),
          candidate.getEndSec().setScale(1, RoundingMode.HALF_UP).toPlainString()
        );
    }
    return trimToLength(
      "%s. Auto-created from analyzed source clip. %s %s Source: %s"
        .formatted(label, segment, candidateNote, source),
      1800
    );
  }

  private String inferPrimaryMuscle(String label) {
    String normalized = normalizeString(label).toLowerCase(Locale.ROOT);
    if (normalized.contains("squat") || normalized.contains("lunge") || normalized.contains("leg")) {
      return "Quadriceps";
    }
    if (normalized.contains("deadlift") || normalized.contains("hinge")) {
      return "Hamstrings";
    }
    if (normalized.contains("push") || normalized.contains("press") || normalized.contains("bench")) {
      return "Chest";
    }
    if (normalized.contains("row") || normalized.contains("pull")) {
      return "Lats";
    }
    if (normalized.contains("carry") || normalized.contains("core") || normalized.contains("plank")) {
      return "Abdominals";
    }
    if (normalized.contains("jump") || normalized.contains("run") || normalized.contains("cardio")) {
      return "Calves";
    }
    return "General";
  }

  private String inferEquipment(String label) {
    String normalized = normalizeString(label).toLowerCase(Locale.ROOT);
    for (String keyword : EQUIPMENT_KEYWORDS) {
      if (normalized.contains(keyword)) {
        return switch (keyword) {
          case "barbell" -> "Barbell";
          case "dumbbell" -> "Dumbbell";
          case "kettlebell" -> "Kettlebells";
          case "cable" -> "Cable";
          case "machine" -> "Machine";
          case "band" -> "Bands";
          default -> "Bodyweight";
        };
      }
    }
    return "Bodyweight";
  }

  private boolean isUnsafeAutoProvisionLabel(String label) {
    String normalized = normalizeString(label);
    if (normalized.isEmpty()) return true;
    String lower = normalized.toLowerCase(Locale.ROOT);
    if (normalized.length() > 72) return true;
    if (lower.matches(".*[\\.!?;:]{2,}.*")) return true;
    if (normalized.matches(".*[\\u3002\\uff01\\uff1f\\uff1b].*")) return true;
    String[] narrativeTokens = {
      "goal",
      "objective",
      "target",
      "rationale",
      "reason",
      "phase",
      "block",
      "plan",
      "program",
      "session",
      "training plan",
      "designed to",
      "we will",
      "in order to",
      "because",
      "therefore",
      "focuses on",
      "prioritizes",
      "\u4e3a\u4e86",
      "\u6211\u4eec\u5c06",
      "\u91c7\u7528",
      "\u76ee\u6807",
      "\u901a\u8fc7",
      "\u63d0\u9ad8",
      "\u53d1\u5c55",
      "\u6240\u9700",
      "\u65b9\u6848",
      "\u9636\u6bb5",
      "\u5b89\u6392",
      "\u5efa\u8bae",
      "\u6ce8\u610f",
      "\u9002\u5408",
      "\u7528\u4e8e",
      "\u5e2e\u52a9"
    };
    for (String token : narrativeTokens) {
      if (lower.contains(token)) {
        return true;
      }
    }
    long wordCount = lower.isBlank() ? 0 : lower.split("\\s+").length;
    if (wordCount > 8) return true;
    long cjkCount = normalized.chars()
      .filter(ch -> ch >= 0x4e00 && ch <= 0x9fa5)
      .count();
    return cjkCount > 18 && (normalized.contains("\uFF0C") || normalized.contains(",") || normalized.contains("\u3001"));
  }

  private Map<String, Object> postForData(String path, Object payload, String actionName) {
    Object raw;
    try {
      if (payload instanceof HttpEntity<?> entity) {
        ResponseEntity<Object> response =
          restTemplate.postForEntity(exerciseServiceBaseUrl + path, entity, Object.class);
        raw = response.getBody();
      } else {
        raw = restTemplate.postForObject(exerciseServiceBaseUrl + path, payload, Object.class);
      }
    } catch (RestClientException ex) {
      throw new IllegalArgumentException(
        "Exercise service request failed while trying to %s: %s".formatted(actionName, ex.getMessage())
      );
    }
    return extractResponseData(raw, actionName);
  }

  @SuppressWarnings("unchecked")
  private Map<String, Object> extractResponseData(Object raw, String actionName) {
    if (!(raw instanceof Map<?, ?> responseMap)) {
      throw new IllegalArgumentException("Exercise service returned invalid response while trying to " + actionName + ".");
    }
    Integer code = toInteger(responseMap.get("code"));
    if (code == null || (code != 0 && code != 200)) {
      Object messageObj = responseMap.containsKey("message")
        ? responseMap.get("message")
        : "Unknown error";
      String message = String.valueOf(messageObj);
      throw new IllegalArgumentException(
        "Exercise service rejected request while trying to %s: %s".formatted(actionName, message)
      );
    }
    Object dataObj = responseMap.get("data");
    if (dataObj == null) {
      return new LinkedHashMap<>();
    }
    if (dataObj instanceof Map<?, ?> dataMap) {
      return (Map<String, Object>) dataMap;
    }
    return objectMapper.convertValue(dataObj, new TypeReference<>() {});
  }

  private Integer toInteger(Object value) {
    if (value == null) return null;
    if (value instanceof Integer i) return i;
    if (value instanceof Number n) return n.intValue();
    if (value instanceof String text) {
      String trimmed = text.trim();
      if (trimmed.isEmpty()) return null;
      try {
        return Integer.parseInt(trimmed);
      } catch (NumberFormatException ignored) {
        return null;
      }
    }
    return null;
  }

  private Long readLong(Map<String, Object> source, String... keys) {
    if (source == null || keys == null) return null;
    for (String key : keys) {
      Object value = source.get(key);
      if (value instanceof Number n) return n.longValue();
      if (value instanceof String text && !text.trim().isEmpty()) {
        try {
          return Long.parseLong(text.trim());
        } catch (NumberFormatException ignored) {
          // try next
        }
      }
    }
    return null;
  }

  private String readString(Map<String, Object> source, String... keys) {
    if (source == null || keys == null) return "";
    for (String key : keys) {
      Object value = source.get(key);
      if (value instanceof String text && !text.trim().isEmpty()) {
        return text.trim();
      }
    }
    return "";
  }

  private String firstNonBlank(String... values) {
    if (values == null) return "";
    for (String value : values) {
      String normalized = normalizeString(value);
      if (!normalized.isEmpty()) {
        return normalized;
      }
    }
    return "";
  }

  private String trimToLength(String value, int maxLength) {
    String normalized = normalizeString(value);
    if (normalized.length() <= maxLength) {
      return normalized;
    }
    return normalized.substring(0, maxLength);
  }

  private String normalizeBaseUrl(String baseUrl) {
    String normalized = normalizeString(baseUrl);
    if (normalized.endsWith("/")) {
      return normalized.substring(0, normalized.length() - 1);
    }
    return normalized;
  }

  private String normalizeString(String value) {
    return value == null ? "" : value.trim();
  }

  private static class NamedByteArrayResource extends ByteArrayResource {
    private final String fileName;

    private NamedByteArrayResource(byte[] byteArray, String fileName) {
      super(byteArray);
      this.fileName = fileName;
    }

    @Override
    public String getFilename() {
      return fileName;
    }
  }

  public record ProvisionResult(
    boolean success,
    Long exerciseId,
    BigDecimal matchScore,
    String note
  ) {
    public static ProvisionResult failed(String note) {
      return new ProvisionResult(false, null, BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP), note);
    }

    public static ProvisionResult succeeded(Long exerciseId, BigDecimal matchScore, String note) {
      BigDecimal safeScore = matchScore == null
        ? BigDecimal.valueOf(90.00).setScale(2, RoundingMode.HALF_UP)
        : matchScore.setScale(2, RoundingMode.HALF_UP);
      return new ProvisionResult(true, exerciseId, safeScore, note);
    }
  }
}
