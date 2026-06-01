package com.somaticbuilding.aiassistant.application;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.conditions.update.LambdaUpdateWrapper;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.somaticbuilding.aiassistant.domain.ContentAnalysisAsset;
import com.somaticbuilding.aiassistant.domain.ContentAnalysisJob;
import com.somaticbuilding.aiassistant.domain.ContentExerciseMapping;
import com.somaticbuilding.aiassistant.domain.ContentMovementCandidate;
import com.somaticbuilding.aiassistant.domain.ContentPlanDraft;
import com.somaticbuilding.aiassistant.domain.ExerciseLite;
import com.somaticbuilding.aiassistant.infrastructure.mapper.ContentAnalysisAssetMapper;
import com.somaticbuilding.aiassistant.infrastructure.mapper.ContentAnalysisJobMapper;
import com.somaticbuilding.aiassistant.infrastructure.mapper.ContentExerciseMappingMapper;
import com.somaticbuilding.aiassistant.infrastructure.mapper.ContentMovementCandidateMapper;
import com.somaticbuilding.aiassistant.infrastructure.mapper.ContentPlanDraftMapper;
import com.somaticbuilding.aiassistant.infrastructure.mapper.ExerciseLiteMapper;
import com.somaticbuilding.aiassistant.interfaces.dto.ContentCandidateResponse;
import com.somaticbuilding.aiassistant.interfaces.dto.ContentCandidateReviewRequest;
import com.somaticbuilding.aiassistant.interfaces.dto.ContentCandidateReviewResponse;
import com.somaticbuilding.aiassistant.interfaces.dto.ContentJobCreateRequest;
import com.somaticbuilding.aiassistant.interfaces.dto.ContentJobCreateResponse;
import com.somaticbuilding.aiassistant.interfaces.dto.ContentJobResponse;
import com.somaticbuilding.aiassistant.interfaces.dto.ContentMaterialAddRequest;
import com.somaticbuilding.aiassistant.interfaces.dto.ContentMaterialAddResponse;
import com.somaticbuilding.aiassistant.interfaces.dto.ContentPlanApplyRequest;
import com.somaticbuilding.aiassistant.interfaces.dto.ContentPlanApplyResponse;
import com.somaticbuilding.aiassistant.interfaces.dto.ContentPlanDirectApplyRequest;
import com.somaticbuilding.aiassistant.interfaces.dto.ContentPlanDraftResponse;
import com.somaticbuilding.aiassistant.interfaces.dto.ContentPlanGenerateRequest;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

@Service
public class ContentAnalysisService {
  private static final Pattern BILIBILI_PATTERN = Pattern.compile("(BV[0-9A-Za-z]+|av\\d+)");
  private static final Pattern DOUYIN_PATTERN = Pattern.compile("video/(\\d+)");
  private static final Pattern XIAOHONGSHU_PATTERN = Pattern.compile("explore/([0-9a-zA-Z]+)");
  private static final List<String> REQUIRED_MATERIAL_HINT = List.of();
  private static final List<String> SOURCE_REQUIRED_MATERIAL_HINT = List.of(
    "captions/subtitle text",
    "audio transcript",
    "clear movement description"
  );
  private static final String AUTO_ASSET_PROVIDER = "auto_extractor";
  private static final int FALLBACK_SUGGESTION_LIMIT = 3;
  private static final BigDecimal RULE_MATCH_ACCEPT_MIN_SCORE = BigDecimal.valueOf(78.00);
  private static final BigDecimal AUTO_PROVISION_MIN_MATCH_SCORE = BigDecimal.valueOf(62.00);

  private static final Set<String> SUPPORTED_PLAN_TYPES = Set.of("course", "module");
  private static final Set<String> SUPPORTED_ASSET_TYPES = Set.of(
    "video",
    "frame",
    "subtitle",
    "manual_note"
  );

  private final ContentAnalysisJobMapper jobMapper;
  private final ContentAnalysisAssetMapper assetMapper;
  private final ContentMovementCandidateMapper candidateMapper;
  private final ContentExerciseMappingMapper mappingMapper;
  private final ContentPlanDraftMapper planDraftMapper;
  private final ExerciseLiteMapper exerciseLiteMapper;
  private final WorkoutServiceGateway workoutServiceGateway;
  private final VideoLinkAutoExtractor videoLinkAutoExtractor;
  private final VideoFrameExtractionService videoFrameExtractionService;
  private final VideoVisualAnalysisService videoVisualAnalysisService;
  private final ExerciseAutoProvisionService exerciseAutoProvisionService;
  private final ChatClient chatClient;
  private final ObjectMapper objectMapper;

  public ContentAnalysisService(
    ContentAnalysisJobMapper jobMapper,
    ContentAnalysisAssetMapper assetMapper,
    ContentMovementCandidateMapper candidateMapper,
    ContentExerciseMappingMapper mappingMapper,
    ContentPlanDraftMapper planDraftMapper,
    ExerciseLiteMapper exerciseLiteMapper,
    WorkoutServiceGateway workoutServiceGateway,
    VideoLinkAutoExtractor videoLinkAutoExtractor,
    VideoFrameExtractionService videoFrameExtractionService,
    VideoVisualAnalysisService videoVisualAnalysisService,
    ExerciseAutoProvisionService exerciseAutoProvisionService,
    ObjectProvider<ChatClient.Builder> chatClientBuilderProvider,
    ObjectProvider<ObjectMapper> objectMapperProvider
  ) {
    this.jobMapper = jobMapper;
    this.assetMapper = assetMapper;
    this.candidateMapper = candidateMapper;
    this.mappingMapper = mappingMapper;
    this.planDraftMapper = planDraftMapper;
    this.exerciseLiteMapper = exerciseLiteMapper;
    this.workoutServiceGateway = workoutServiceGateway;
    this.videoLinkAutoExtractor = videoLinkAutoExtractor;
    this.videoFrameExtractionService = videoFrameExtractionService;
    this.videoVisualAnalysisService = videoVisualAnalysisService;
    this.exerciseAutoProvisionService = exerciseAutoProvisionService;
    ChatClient.Builder chatBuilder = chatClientBuilderProvider.getIfAvailable();
    this.chatClient = chatBuilder == null ? null : chatBuilder.build();
    this.objectMapper = objectMapperProvider.getIfAvailable(ObjectMapper::new);
  }

  @Transactional
  public ContentJobCreateResponse createJob(ContentJobCreateRequest request) {
    String sourceUrl = normalizeString(request.getSourceUrl());
    if (sourceUrl.isEmpty()) {
      throw new IllegalArgumentException("source_url cannot be empty.");
    }

    String platform = detectPlatform(sourceUrl);
    String planType = normalizePlanType(request.getGoalType(), "course");
    String analysisMode = normalizeString(request.getAnalysisMode());
    if (analysisMode.isEmpty()) {
      analysisMode = "url_only";
    }

    ContentAnalysisJob job = new ContentAnalysisJob();
    LocalDateTime now = LocalDateTime.now();
    job.setUserId(request.getUserId());
    job.setSourcePlatform(platform);
    job.setSourceUrl(sourceUrl);
    job.setSourceVideoId(extractVideoId(platform, sourceUrl));
    job.setAnalysisMode(analysisMode);
    job.setGoalType(planType);
    job.setPipelineStatus("queued");
    job.setStatus(1);
    job.setIsDeleted(0);
    job.setCreateTime(now);
    job.setUpdateTime(now);
    job.setRequestPayload(serializeJson(request.getUserConstraints()));
    jobMapper.insert(job);

    ContentJobCreateResponse response = new ContentJobCreateResponse();
    response.setJobId(job.getId());
    response.setStatus(job.getPipelineStatus());
    response.setSourcePlatform(job.getSourcePlatform());
    response.setRequiredMaterial(REQUIRED_MATERIAL_HINT);
    return response;
  }

  @Transactional
  public ContentMaterialAddResponse addMaterials(Long jobId, ContentMaterialAddRequest request) {
    ContentAnalysisJob job = requireActiveJob(jobId);
    if (request == null || request.getMaterials() == null || request.getMaterials().isEmpty()) {
      throw new IllegalArgumentException("materials cannot be empty.");
    }

    int addedCount = 0;
    for (ContentMaterialAddRequest.MaterialItem item : request.getMaterials()) {
      if (item == null) {
        continue;
      }
      String assetType = normalizeAssetType(item.getAssetType());
      String storageKey = normalizeString(item.getStorageKey());
      String sourceUrl = normalizeString(item.getSourceUrl());
      String contentText = normalizeString(item.getContentText());
      if (storageKey.isEmpty() && sourceUrl.isEmpty() && contentText.isEmpty()) {
        continue;
      }

      ContentAnalysisAsset asset = new ContentAnalysisAsset();
      LocalDateTime now = LocalDateTime.now();
      asset.setJobId(jobId);
      asset.setAssetType(assetType);
      asset.setStorageProvider(
        normalizeString(item.getStorageProvider()).isEmpty()
          ? "local"
          : normalizeString(item.getStorageProvider())
      );
      asset.setStorageKey(storageKey.isEmpty() ? null : storageKey);
      asset.setSourceUrl(sourceUrl.isEmpty() ? null : sourceUrl);
      asset.setContentText(contentText.isEmpty() ? null : contentText);
      asset.setDurationSec(item.getDurationSec());
      asset.setMetadataJson(serializeJson(item.getMetadata()));
      asset.setStatus(1);
      asset.setIsDeleted(0);
      asset.setCreateTime(now);
      asset.setUpdateTime(now);
      assetMapper.insert(asset);
      addedCount += 1;
    }

    if (addedCount <= 0) {
      throw new IllegalArgumentException("No valid material item found.");
    }

    LocalDateTime now = LocalDateTime.now();
    job.setPipelineStatus("queued");
    job.setUpdateTime(now);
    jobMapper.updateById(job);

    ContentMaterialAddResponse response = new ContentMaterialAddResponse();
    response.setJobId(job.getId());
    response.setAddedCount(addedCount);
    response.setStatus(job.getPipelineStatus());
    return response;
  }

  @Transactional
  public ContentJobResponse startAnalyze(Long jobId) {
    ContentAnalysisJob job = requireActiveJob(jobId);
    LocalDateTime now = LocalDateTime.now();
    job.setPipelineStatus("processing");
    job.setErrorCode(null);
    job.setErrorMessage(null);
    job.setUpdateTime(now);
    jobMapper.updateById(job);

    List<ContentAnalysisAsset> assets = listActiveAssets(jobId);
    assets = enrichAssetsByAutoExtraction(job, assets);
    String mergedText = collectAnalysisText(job, assets);
    Map<String, Object> insight = buildContentInsight(job, assets, mergedText);

    softDeleteCandidates(jobId);
    softDeleteMappings(jobId);
    softDeletePlans(jobId);

    List<GeneratedCandidateSeed> seeds = new ArrayList<>();
    seeds.addAll(generateVisualObservationSeeds(assets, job.getGoalType()));
    seeds.addAll(generateCandidateSeeds(mergedText, job.getGoalType(), insight));
    seeds = deduplicateSeeds(seeds);
    if (seeds.isEmpty()) {
      int visualFrameCount = countVisualFrameAssets(assets);
      Map<String, Object> analysisSummary = buildAnalysisSummary(mergedText, List.of(), insight);
      analysisSummary.put(
        "extraction_status",
        visualFrameCount > 0 ? "visual_review_required" : "insufficient_source"
      );
      analysisSummary.put("required_material", sourceRequiredMaterial(visualFrameCount));
      job.setPipelineStatus(visualFrameCount > 0 ? "visual_review_required" : "material_required");
      job.setErrorCode("SOURCE_CONTENT_INSUFFICIENT");
      job.setErrorMessage(
        visualFrameCount > 0
          ? "Visual keyframes were extracted, but movement labels require visual model review before plan generation."
          : "Could not extract reliable movement content from this link. Please confirm the source or provide a link with captions/audio."
      );
      job.setConfidenceScore(BigDecimal.valueOf(0.00).setScale(2, RoundingMode.HALF_UP));
      job.setResultSummary(
        visualFrameCount > 0
          ? "Visual keyframes extracted for review, but no reliable movement labels were generated."
          : "Source content was insufficient for reliable movement extraction. No fallback exercises were generated."
      );
      job.setAnalysisResultJson(serializeJson(analysisSummary));
      job.setUpdateTime(LocalDateTime.now());
      jobMapper.updateById(job);
      return buildJobResponse(job);
    }

    List<ContentMovementCandidate> insertedCandidates = new ArrayList<>();
    for (GeneratedCandidateSeed seed : seeds) {
      ContentMovementCandidate candidate = new ContentMovementCandidate();
      LocalDateTime candidateNow = LocalDateTime.now();
      candidate.setJobId(jobId);
      candidate.setRawLabel(seed.label);
      candidate.setNormalizedLabel(seed.label);
      candidate.setStartSec(seed.startSec);
      candidate.setEndSec(seed.endSec);
      candidate.setConfidence(seed.confidence);
      candidate.setNotes(seed.reason);
      candidate.setReviewState("pending");
      candidate.setStatus(1);
      candidate.setIsDeleted(0);
      candidate.setCreateTime(candidateNow);
      candidate.setUpdateTime(candidateNow);
      candidateMapper.insert(candidate);
      insertedCandidates.add(candidate);
    }

    List<ExerciseLite> activeExercises = listActiveExercises(500);
    for (int i = 0; i < insertedCandidates.size(); i += 1) {
      ContentMovementCandidate candidate = insertedCandidates.get(i);
      List<ExerciseMatch> topRuleMatches = findTopExerciseMatches(
        candidate.getNormalizedLabel(),
        activeExercises,
        FALLBACK_SUGGESTION_LIMIT
      );
      ExerciseMatch bestMatch = topRuleMatches.isEmpty() ? null : topRuleMatches.get(0);
      Long mappedExerciseId = null;
      BigDecimal matchScore = bestMatch == null
        ? BigDecimal.valueOf(0.00).setScale(2, RoundingMode.HALF_UP)
        : bestMatch.score.setScale(2, RoundingMode.HALF_UP);
      String mappingSource = "unresolved";

      if (bestMatch != null && bestMatch.exercise != null) {
        boolean isAccurateRuleMatch = matchScore.compareTo(RULE_MATCH_ACCEPT_MIN_SCORE) >= 0;
        if (isAccurateRuleMatch) {
          mappedExerciseId = bestMatch.exercise.getId();
          mappingSource = "rule_exact";
        }
      }

      if (mappedExerciseId == null || matchScore.compareTo(AUTO_PROVISION_MIN_MATCH_SCORE) < 0) {
        ExerciseAutoProvisionService.ProvisionResult provisionResult =
          exerciseAutoProvisionService.provisionFromCandidate(job, candidate);
        if (provisionResult.success() && provisionResult.exerciseId() != null) {
          mappedExerciseId = provisionResult.exerciseId();
          matchScore = provisionResult.matchScore();
          mappingSource = "auto_clip";
          String note = normalizeString(provisionResult.note());
          if (!note.isEmpty()) {
            String existingNotes = normalizeString(candidate.getNotes());
            candidate.setNotes(existingNotes.isEmpty() ? note : existingNotes + " | " + note);
            candidate.setUpdateTime(LocalDateTime.now());
            candidateMapper.updateById(candidate);
          }
        } else if (mappedExerciseId != null) {
          mappingSource = "rule_fallback";
          String reason = normalizeString(provisionResult.note());
          if (!reason.isEmpty()) {
            String existingNotes = normalizeString(candidate.getNotes());
            candidate.setNotes(existingNotes.isEmpty() ? reason : existingNotes + " | " + reason);
            candidate.setUpdateTime(LocalDateTime.now());
            candidateMapper.updateById(candidate);
          }
        } else {
          String reason = normalizeString(provisionResult.note());
          String base = "auto_provision_failed";
          candidate.setReviewState("needs_review");
          candidate.setNotes(
            normalizeString(candidate.getNotes()).isEmpty()
              ? (reason.isEmpty() ? base : base + " | " + reason)
              : normalizeString(candidate.getNotes()) + " | " + (reason.isEmpty() ? base : base + " | " + reason)
          );
          candidate.setUpdateTime(LocalDateTime.now());
          candidateMapper.updateById(candidate);
        }
      }

      if (mappedExerciseId != null) {
        ContentExerciseMapping mapping = new ContentExerciseMapping();
        LocalDateTime mapNow = LocalDateTime.now();
        mapping.setJobId(jobId);
        mapping.setCandidateId(candidate.getId());
        mapping.setExerciseId(mappedExerciseId);
        mapping.setMatchScore(matchScore);
        mapping.setMappingSource(mappingSource);
        mapping.setFinalSelected(1);
        mapping.setStatus(1);
        mapping.setIsDeleted(0);
        mapping.setCreateTime(mapNow);
        mapping.setUpdateTime(mapNow);
        mappingMapper.insert(mapping);
      }

      for (ExerciseMatch fallbackMatch : topRuleMatches) {
        if (fallbackMatch == null || fallbackMatch.exercise == null || fallbackMatch.exercise.getId() == null) {
          continue;
        }
        if (mappedExerciseId != null && mappedExerciseId.equals(fallbackMatch.exercise.getId())) {
          continue;
        }
        ContentExerciseMapping fallback = new ContentExerciseMapping();
        LocalDateTime fallbackNow = LocalDateTime.now();
        fallback.setJobId(jobId);
        fallback.setCandidateId(candidate.getId());
        fallback.setExerciseId(fallbackMatch.exercise.getId());
        fallback.setMatchScore(fallbackMatch.score.setScale(2, RoundingMode.HALF_UP));
        fallback.setMappingSource("candidate_fallback");
        fallback.setFinalSelected(0);
        fallback.setStatus(1);
        fallback.setIsDeleted(0);
        fallback.setCreateTime(fallbackNow);
        fallback.setUpdateTime(fallbackNow);
        mappingMapper.insert(fallback);
      }

      if (mappedExerciseId == null) {
        candidate.setReviewState("needs_review");
      } else if ("needs_review".equalsIgnoreCase(normalizeString(candidate.getReviewState()))) {
        candidate.setReviewState("pending");
      }
      candidate.setUpdateTime(LocalDateTime.now());
      candidateMapper.updateById(candidate);
    }

    BigDecimal confidenceScore = averageConfidence(insertedCandidates);
    job.setPipelineStatus("awaiting_candidate_review");
    job.setConfidenceScore(confidenceScore);
    job.setResultSummary(buildResultSummary(insight, insertedCandidates.size()));
    job.setAnalysisResultJson(serializeJson(buildAnalysisSummary(mergedText, insertedCandidates, insight)));
    job.setUpdateTime(LocalDateTime.now());
    jobMapper.updateById(job);

    return buildJobResponse(job);
  }

  public ContentJobResponse getJob(Long jobId) {
    ContentAnalysisJob job = requireActiveJob(jobId);
    return buildJobResponse(job);
  }

  public Path getFrameAssetFile(Long jobId, Long assetId) {
    requireActiveJob(jobId);
    if (assetId == null || assetId <= 0) {
      throw new IllegalArgumentException("asset_id is required.");
    }
    ContentAnalysisAsset asset = assetMapper.selectOne(
      new LambdaQueryWrapper<ContentAnalysisAsset>()
        .eq(ContentAnalysisAsset::getId, assetId)
        .eq(ContentAnalysisAsset::getJobId, jobId)
        .eq(ContentAnalysisAsset::getIsDeleted, 0)
        .last("LIMIT 1")
    );
    if (asset == null) {
      throw new IllegalArgumentException("Frame asset not found.");
    }
    if (!"frame".equalsIgnoreCase(normalizeString(asset.getAssetType()))) {
      throw new IllegalArgumentException("Only frame image assets can be previewed.");
    }
    String pathText = normalizeString(asset.getStorageKey());
    if (pathText.isEmpty()) {
      Object metadata = parseJsonSafely(asset.getMetadataJson());
      pathText = mapText(metadata, "file_path", "filePath");
    }
    if (pathText.isEmpty()) {
      throw new IllegalArgumentException("Frame asset file path is missing.");
    }
    Path path = Path.of(pathText).toAbsolutePath().normalize();
    if (!Files.exists(path) || !Files.isRegularFile(path)) {
      throw new IllegalArgumentException("Frame asset file no longer exists.");
    }
    return path;
  }

  public List<ContentCandidateResponse> listCandidates(Long jobId) {
    requireActiveJob(jobId);
    List<ContentMovementCandidate> candidates = candidateMapper.selectList(
      new LambdaQueryWrapper<ContentMovementCandidate>()
        .eq(ContentMovementCandidate::getJobId, jobId)
        .eq(ContentMovementCandidate::getIsDeleted, 0)
        .orderByAsc(ContentMovementCandidate::getId)
    );

    List<ContentExerciseMapping> mappings = mappingMapper.selectList(
      new LambdaQueryWrapper<ContentExerciseMapping>()
        .eq(ContentExerciseMapping::getJobId, jobId)
        .eq(ContentExerciseMapping::getIsDeleted, 0)
        .orderByDesc(ContentExerciseMapping::getFinalSelected)
        .orderByDesc(ContentExerciseMapping::getMatchScore)
        .orderByAsc(ContentExerciseMapping::getId)
    );

    Map<Long, List<ContentExerciseMapping>> mappingByCandidate = new HashMap<>();
    for (ContentExerciseMapping mapping : mappings) {
      if (mapping == null || mapping.getCandidateId() == null) {
        continue;
      }
      mappingByCandidate
        .computeIfAbsent(mapping.getCandidateId(), key -> new ArrayList<>())
        .add(mapping);
    }
    Set<Long> exerciseIds = new HashSet<>();
    for (List<ContentExerciseMapping> items : mappingByCandidate.values()) {
      for (ContentExerciseMapping mapping : items) {
        if (mapping.getExerciseId() != null) {
          exerciseIds.add(mapping.getExerciseId());
        }
      }
    }
    Map<Long, ExerciseLite> exerciseById = loadExercisesById(exerciseIds);
    List<ExerciseLite> activeExercises = listActiveExercises(500);

    List<ContentCandidateResponse> responses = new ArrayList<>();
    for (ContentMovementCandidate candidate : candidates) {
      List<ContentExerciseMapping> candidateMappings =
        mappingByCandidate.getOrDefault(candidate.getId(), List.of());
      ContentExerciseMapping mapping = candidateMappings.isEmpty() ? null : candidateMappings.get(0);
      ExerciseLite mappedExercise = mapping == null ? null : exerciseById.get(mapping.getExerciseId());
      ContentCandidateResponse response = new ContentCandidateResponse();
      response.setCandidateId(candidate.getId());
      response.setRawLabel(candidate.getRawLabel());
      response.setNormalizedLabel(candidate.getNormalizedLabel());
      response.setStartSec(candidate.getStartSec());
      response.setEndSec(candidate.getEndSec());
      response.setConfidence(candidate.getConfidence());
      response.setReviewState(candidate.getReviewState());
      response.setNotes(candidate.getNotes());
      if (mapping != null) {
        response.setMappedExerciseId(mapping.getExerciseId());
        response.setMatchScore(mapping.getMatchScore());
        response.setFinalSelected(mapping.getFinalSelected());
      }
      response.setMappedExerciseName(mappedExercise == null ? null : mappedExercise.getName());

      List<ContentCandidateResponse.AlternativeExerciseOption> options = new ArrayList<>();
      Set<Long> optionExerciseIds = new HashSet<>();
      for (ContentExerciseMapping row : candidateMappings) {
        if (row == null || row.getExerciseId() == null) {
          continue;
        }
        ExerciseLite optionExercise = exerciseById.get(row.getExerciseId());
        if (optionExercise == null || normalizeString(optionExercise.getName()).isEmpty()) {
          continue;
        }
        if (!optionExerciseIds.add(optionExercise.getId())) {
          continue;
        }
        ContentCandidateResponse.AlternativeExerciseOption option =
          new ContentCandidateResponse.AlternativeExerciseOption();
        option.setExerciseId(optionExercise.getId());
        option.setExerciseName(optionExercise.getName());
        option.setMatchScore(row.getMatchScore());
        option.setFinalSelected(row.getFinalSelected());
        option.setMappingSource(row.getMappingSource());
        options.add(option);
      }

      if (options.isEmpty()) {
        List<ExerciseMatch> dynamicFallbacks = findTopExerciseMatches(
          candidate.getNormalizedLabel(),
          activeExercises,
          FALLBACK_SUGGESTION_LIMIT
        );
        for (ExerciseMatch fallback : dynamicFallbacks) {
          if (fallback == null || fallback.exercise == null || fallback.exercise.getId() == null) {
            continue;
          }
          if (!optionExerciseIds.add(fallback.exercise.getId())) {
            continue;
          }
          ContentCandidateResponse.AlternativeExerciseOption option =
            new ContentCandidateResponse.AlternativeExerciseOption();
          option.setExerciseId(fallback.exercise.getId());
          option.setExerciseName(fallback.exercise.getName());
          option.setMatchScore(fallback.score.setScale(2, RoundingMode.HALF_UP));
          option.setFinalSelected(0);
          option.setMappingSource("dynamic_fallback");
          options.add(option);
        }
      }
      response.setAlternativeExercises(options);
      responses.add(response);
    }
    return responses;
  }

  @Transactional
  public ContentCandidateReviewResponse reviewCandidates(
    Long jobId,
    ContentCandidateReviewRequest request
  ) {
    ContentAnalysisJob job = requireActiveJob(jobId);
    if (request == null || request.getUpdates() == null || request.getUpdates().isEmpty()) {
      throw new IllegalArgumentException("updates cannot be empty.");
    }

    int updated = 0;
    for (ContentCandidateReviewRequest.UpdateItem item : request.getUpdates()) {
      ContentMovementCandidate candidate = candidateMapper.selectOne(
        new LambdaQueryWrapper<ContentMovementCandidate>()
          .eq(ContentMovementCandidate::getId, item.getCandidateId())
          .eq(ContentMovementCandidate::getJobId, jobId)
          .eq(ContentMovementCandidate::getIsDeleted, 0)
          .last("LIMIT 1")
      );
      if (candidate == null) {
        continue;
      }

      String action = normalizeString(item.getAction()).toLowerCase(Locale.ROOT);
      String reviewState = switch (action) {
        case "accept", "accepted" -> "accepted";
        case "reject", "rejected" -> "rejected";
        case "replace", "edit", "edited" -> "edited";
        default -> throw new IllegalArgumentException("Unsupported candidate action: " + item.getAction());
      };

      candidate.setReviewState(reviewState);
      String notes = normalizeString(item.getNotes());
      if (!notes.isEmpty()) {
        candidate.setNotes(notes);
      }
      candidate.setUpdateTime(LocalDateTime.now());
      candidateMapper.updateById(candidate);

      if ("rejected".equals(reviewState)) {
        mappingMapper.update(
          null,
          new LambdaUpdateWrapper<ContentExerciseMapping>()
            .eq(ContentExerciseMapping::getCandidateId, candidate.getId())
            .eq(ContentExerciseMapping::getIsDeleted, 0)
            .set(ContentExerciseMapping::getFinalSelected, 0)
            .set(ContentExerciseMapping::getUpdateTime, LocalDateTime.now())
        );
      } else {
        Long selectedExerciseId = item.getMappedExerciseId();
        if (selectedExerciseId == null || selectedExerciseId <= 0) {
          selectedExerciseId = autoProvisionCandidateMapping(job, candidate);
        }
        resolveCandidateMapping(jobId, candidate.getId(), selectedExerciseId);
      }
      updated += 1;
    }

    job.setPipelineStatus("awaiting_candidate_review");
    job.setUpdateTime(LocalDateTime.now());
    jobMapper.updateById(job);

    ContentCandidateReviewResponse response = new ContentCandidateReviewResponse();
    response.setJobId(jobId);
    response.setUpdatedCount(updated);
    response.setStatus(job.getPipelineStatus());
    return response;
  }

  @Transactional
  public List<ContentPlanDraftResponse> generatePlans(Long jobId, ContentPlanGenerateRequest request) {
    ContentAnalysisJob job = requireActiveJob(jobId);
    String planType = normalizePlanType(
      request == null ? null : request.getPlanType(),
      normalizePlanType(job.getGoalType(), "course")
    );
    boolean sourceReconstruction = isSourceReconstructionRequest(request);
    int optionCount = sourceReconstruction ? 1 : clampOptions(request == null ? null : request.getOptions());
    String style = inferStyle(job, request == null ? null : request.getStyleHint());

    if (hasPendingCandidateReview(jobId)) {
      throw new IllegalArgumentException(
        "Candidate review is required before generating plans. Please confirm candidate mappings first."
      );
    }

    softDeletePlans(jobId);

    List<ExerciseAssignment> rawExercisePool = resolveExerciseAssignments(jobId);
    List<ExerciseAssignment> exercisePool = ensureDiverseExercisePool(
      job,
      planType,
      style,
      rawExercisePool,
      sourceReconstruction
    );
    if (exercisePool.isEmpty()) {
      throw new IllegalArgumentException("No mapped exercise found. Please review candidates first.");
    }

    List<String> blocks = sourceReconstruction
      ? blocksForSourceReconstruction(planType, exercisePool)
      : blocksForRequestOrStyle(job, request, style, planType);
    List<Map<String, Object>> aiStructures = tryGeneratePlanStructuresByAi(
      job,
      request,
      planType,
      style,
      optionCount,
      blocks,
      exercisePool,
      sourceReconstruction
    );
    List<ContentPlanDraft> created = new ArrayList<>();
    Set<String> optionSignatures = new HashSet<>();
    for (int i = 1; i <= optionCount; i += 1) {
      Map<String, Object> structure = i <= aiStructures.size()
        ? aiStructures.get(i - 1)
        : null;
      if (structure == null || (!sourceReconstruction && isLowQualityPlanStructure(structure, planType))) {
        structure = buildPlanStructure(
          job,
          planType,
          style,
          i,
          blocks,
          exercisePool,
          sourceReconstruction
        );
      }
      structure = normalizePlanStructure(
        job,
        structure,
        planType,
        style,
        i,
        blocks,
        exercisePool,
        sourceReconstruction
      );
      String signature = planStructureExerciseSignature(structure);
      if (!signature.isEmpty() && optionSignatures.contains(signature)) {
        structure = buildPlanStructure(
          job,
          planType,
          style,
            i,
            blocks,
            exercisePool,
            sourceReconstruction
          );
        structure = normalizePlanStructure(
          job,
          structure,
          planType,
          style,
          i,
          blocks,
          exercisePool,
          sourceReconstruction
        );
        signature = planStructureExerciseSignature(structure);
      }
      if (!signature.isEmpty()) {
        optionSignatures.add(signature);
      }
      ContentPlanDraft draft = new ContentPlanDraft();
      LocalDateTime now = LocalDateTime.now();
      draft.setJobId(jobId);
      draft.setPlanType(planType);
      draft.setOptionIndex(i);
      draft.setStyle(style);
      String title = mapText(structure, "title", "plan_title");
      draft.setTitle(title.isEmpty() ? buildPlanTitle(style, planType, i) : title);
      String summary = mapText(structure, "summary", "rationale", "progression");
      draft.setSummary(
        summary.isEmpty()
          ? buildPlanSummary(style, planType, i, blocks.size())
          : truncate(summary, 220)
      );
      draft.setStructureJson(serializeJson(structure));
      draft.setStatusLabel("draft");
      draft.setStatus(1);
      draft.setIsDeleted(0);
      draft.setCreateTime(now);
      draft.setUpdateTime(now);
      planDraftMapper.insert(draft);
      created.add(draft);
    }

    job.setPipelineStatus("awaiting_plan_confirm");
    job.setResultSummary(
      sourceReconstruction
        ? "Generated one source-based %s plan from the analyzed video. Preview and confirm."
          .formatted(planType)
        : "Generated %d %s options in %s style. Preview and confirm one option."
          .formatted(created.size(), planType, style)
    );
    job.setUpdateTime(LocalDateTime.now());
    jobMapper.updateById(job);

    return toPlanResponses(created);
  }

  public List<ContentPlanDraftResponse> listPlans(Long jobId) {
    requireActiveJob(jobId);
    List<ContentPlanDraft> plans = planDraftMapper.selectList(
      new LambdaQueryWrapper<ContentPlanDraft>()
        .eq(ContentPlanDraft::getJobId, jobId)
        .eq(ContentPlanDraft::getIsDeleted, 0)
        .orderByAsc(ContentPlanDraft::getOptionIndex)
    );
    return toPlanResponses(plans);
  }

  @Transactional
  public ContentPlanApplyResponse applyPlan(
    Long jobId,
    Long planId,
    ContentPlanApplyRequest request
  ) {
    ContentAnalysisJob job = requireActiveJob(jobId);
    ContentPlanDraft plan = planDraftMapper.selectOne(
      new LambdaQueryWrapper<ContentPlanDraft>()
        .eq(ContentPlanDraft::getId, planId)
        .eq(ContentPlanDraft::getJobId, jobId)
        .eq(ContentPlanDraft::getIsDeleted, 0)
        .last("LIMIT 1")
    );
    if (plan == null) {
      throw new IllegalArgumentException("Plan draft not found.");
    }

    WorkoutServiceGateway.ApplyPlanRequest applyRequest = new WorkoutServiceGateway.ApplyPlanRequest();
    applyRequest.setUserId(job.getUserId());
    applyRequest.setPlanType(plan.getPlanType());
    applyRequest.setPlanStyle(plan.getStyle());
    applyRequest.setPlanTitle(plan.getTitle());
    applyRequest.setStructure(parseJsonSafely(plan.getStructureJson()));
    applyRequest.setSaveTemplate(request != null && Boolean.TRUE.equals(request.getSaveTemplate()));

    WorkoutServiceGateway.WorkoutApplyResult applyResult = workoutServiceGateway.applyPlanToWorkout(
      applyRequest
    );

    LocalDateTime now = LocalDateTime.now();
    planDraftMapper.update(
      null,
      new LambdaUpdateWrapper<ContentPlanDraft>()
        .eq(ContentPlanDraft::getJobId, jobId)
        .eq(ContentPlanDraft::getIsDeleted, 0)
        .set(ContentPlanDraft::getStatusLabel, "discarded")
        .set(ContentPlanDraft::getUpdateTime, now)
    );
    plan.setStatusLabel("confirmed");
    plan.setUpdateTime(now);
    planDraftMapper.updateById(plan);

    job.setPipelineStatus("applied");
    job.setUpdateTime(now);
    jobMapper.updateById(job);

    String applyTarget = normalizeString(request == null ? null : request.getApplyTarget());
    if (applyTarget.isEmpty()) {
      applyTarget = "workout_builder";
    }

    ContentPlanApplyResponse response = new ContentPlanApplyResponse();
    response.setJobId(jobId);
    response.setPlanId(planId);
    response.setStatus("applied");
    response.setApplyTarget(applyTarget);
    response.setSessionId(applyResult.getSessionId());
    response.setTemplateId(applyResult.getTemplateId());
    response.setNote(
      "Applied to workout-service. Created session with %d blocks, %d groups, %d exercises."
        .formatted(
          applyResult.getBlockCount() == null ? 0 : applyResult.getBlockCount(),
          applyResult.getGroupCount() == null ? 0 : applyResult.getGroupCount(),
          applyResult.getExerciseCount() == null ? 0 : applyResult.getExerciseCount()
        )
    );
    return response;
  }

  @Transactional
  public ContentPlanApplyResponse applyDirectPlan(ContentPlanDirectApplyRequest request) {
    if (request == null) {
      throw new IllegalArgumentException("Direct apply request cannot be empty.");
    }

    WorkoutServiceGateway.ApplyPlanRequest applyRequest = new WorkoutServiceGateway.ApplyPlanRequest();
    applyRequest.setUserId(request.getUserId());
    applyRequest.setPlanType(normalizePlanType(request.getPlanType(), "course"));
    applyRequest.setPlanStyle(normalizeString(request.getStyle()));
    applyRequest.setPlanTitle(normalizeString(request.getTitle()));
    applyRequest.setStructure(request.getStructure());
    applyRequest.setSaveTemplate(Boolean.TRUE.equals(request.getSaveTemplate()));

    WorkoutServiceGateway.WorkoutApplyResult applyResult = workoutServiceGateway.applyPlanToWorkout(
      applyRequest
    );

    String applyTarget = normalizeString(request.getApplyTarget());
    if (applyTarget.isEmpty()) {
      applyTarget = "workout_builder";
    }

    ContentPlanApplyResponse response = new ContentPlanApplyResponse();
    response.setJobId(null);
    response.setPlanId(null);
    response.setStatus("applied");
    response.setApplyTarget(applyTarget);
    response.setSessionId(applyResult.getSessionId());
    response.setTemplateId(applyResult.getTemplateId());
    response.setNote(
      "Direct apply completed. Created session with %d blocks, %d groups, %d exercises."
        .formatted(
          applyResult.getBlockCount() == null ? 0 : applyResult.getBlockCount(),
          applyResult.getGroupCount() == null ? 0 : applyResult.getGroupCount(),
          applyResult.getExerciseCount() == null ? 0 : applyResult.getExerciseCount()
        )
    );
    return response;
  }

  private ContentAnalysisJob requireActiveJob(Long jobId) {
    ContentAnalysisJob job = jobMapper.selectOne(
      new LambdaQueryWrapper<ContentAnalysisJob>()
        .eq(ContentAnalysisJob::getId, jobId)
        .eq(ContentAnalysisJob::getIsDeleted, 0)
        .last("LIMIT 1")
    );
    if (job == null) {
      throw new IllegalArgumentException("Content analysis job not found.");
    }
    return job;
  }

  private List<ContentAnalysisAsset> listActiveAssets(Long jobId) {
    return assetMapper.selectList(
      new LambdaQueryWrapper<ContentAnalysisAsset>()
        .eq(ContentAnalysisAsset::getJobId, jobId)
        .eq(ContentAnalysisAsset::getIsDeleted, 0)
        .orderByAsc(ContentAnalysisAsset::getId)
    );
  }

  private int countActiveAssets(Long jobId) {
    Long count = assetMapper.selectCount(
      new LambdaQueryWrapper<ContentAnalysisAsset>()
        .eq(ContentAnalysisAsset::getJobId, jobId)
        .eq(ContentAnalysisAsset::getIsDeleted, 0)
    );
    return count == null ? 0 : count.intValue();
  }

  private int countActiveCandidates(Long jobId) {
    Long count = candidateMapper.selectCount(
      new LambdaQueryWrapper<ContentMovementCandidate>()
        .eq(ContentMovementCandidate::getJobId, jobId)
        .eq(ContentMovementCandidate::getIsDeleted, 0)
    );
    return count == null ? 0 : count.intValue();
  }

  private int countActivePlans(Long jobId) {
    Long count = planDraftMapper.selectCount(
      new LambdaQueryWrapper<ContentPlanDraft>()
        .eq(ContentPlanDraft::getJobId, jobId)
        .eq(ContentPlanDraft::getIsDeleted, 0)
    );
    return count == null ? 0 : count.intValue();
  }

  private String collectAnalysisText(ContentAnalysisJob job, List<ContentAnalysisAsset> assets) {
    StringBuilder builder = new StringBuilder();
    builder.append(normalizeString(job.getSourceUrl())).append(" ");
    builder.append(normalizeString(job.getSourceVideoId())).append(" ");
    for (ContentAnalysisAsset asset : assets) {
      builder.append(normalizeString(asset.getContentText())).append(" ");
      builder.append(normalizeString(asset.getSourceUrl())).append(" ");
    }
    return builder.toString().trim();
  }

  private List<ContentAnalysisAsset> enrichAssetsByAutoExtraction(
    ContentAnalysisJob job,
    List<ContentAnalysisAsset> existingAssets
  ) {
    if (job == null) {
      return existingAssets == null ? List.of() : existingAssets;
    }
    List<ContentAnalysisAsset> safeAssets = existingAssets == null ? new ArrayList<>() : existingAssets;
    if (hasAutoTextAsset(safeAssets)) {
      return enrichWithVisualFramesIfNeeded(job, safeAssets, collectAutoAssetText(safeAssets));
    }

    VideoLinkAutoExtractor.ExtractionResult extracted = videoLinkAutoExtractor.extract(job.getSourceUrl());
    if (extracted == null || !extracted.hasAnyText()) {
      return enrichWithVisualFramesIfNeeded(job, safeAssets, "");
    }

    persistAutoExtractionAsset(
      job.getId(),
      "subtitle",
      job.getSourceUrl(),
      extracted.getSubtitleText(),
      extracted.getMetadata()
    );
    persistAutoExtractionAsset(
      job.getId(),
      "manual_note",
      job.getSourceUrl(),
      extracted.getSummaryText(),
      buildAutoSummaryMetadata(extracted)
    );

    List<ContentAnalysisAsset> refreshed = listActiveAssets(job.getId());
    String extractedText = String.join(
      " ",
      normalizeString(extracted.getSubtitleText()),
      normalizeString(extracted.getDescription()),
      normalizeString(extracted.getTitle()),
      String.join(" ", extracted.getTags())
    );
    return enrichWithVisualFramesIfNeeded(job, refreshed, extractedText);
  }

  private List<ContentAnalysisAsset> enrichWithVisualFramesIfNeeded(
    ContentAnalysisJob job,
    List<ContentAnalysisAsset> assets,
    String sourceText
  ) {
    if (job == null) {
      return assets == null ? List.of() : assets;
    }
    List<ContentAnalysisAsset> safeAssets = assets == null ? new ArrayList<>() : assets;
    if (hasVisualModelAsset(safeAssets)) {
      return safeAssets;
    }
    if (hasAutoFrameAsset(safeAssets)) {
      List<VideoFrameExtractionService.FrameAsset> persistedFrames = buildFrameAssetsFromPersistedAssets(safeAssets);
      if (!persistedFrames.isEmpty()) {
        VideoVisualAnalysisService.VisualAnalysisResult visualResult =
          videoVisualAnalysisService.analyze(persistedFrames, sourceText);
        persistVisualAnalysisAsset(job, visualResult, Set.of("reused_persisted_frames"));
        return listActiveAssets(job.getId());
      }
      return safeAssets;
    }
    if (hasSufficientMovementSignal(sourceText)) {
      return safeAssets;
    }

    VideoFrameExtractionService.FrameExtractionResult frameResult =
      videoFrameExtractionService.extract(job.getSourceUrl(), job.getId());
    if (frameResult == null || !frameResult.hasFrames()) {
      String warning = frameResult == null || frameResult.getWarnings().isEmpty()
        ? "visual_frame_extraction_failed"
        : "visual_frame_extraction_failed:" + String.join(" | ", frameResult.getWarnings());
      persistAutoExtractionAsset(
        job.getId(),
        "manual_note",
        job.getSourceUrl(),
        warning,
        Map.of("source", "auto_visual_frame_extractor", "warnings", frameResult == null ? List.of() : frameResult.getWarnings())
      );
      return listActiveAssets(job.getId());
    }

    for (VideoFrameExtractionService.FrameAsset frame : frameResult.getFrames()) {
      persistFrameAsset(job, frame, frameResult.getWarnings());
    }
    VideoVisualAnalysisService.VisualAnalysisResult visualResult =
      videoVisualAnalysisService.analyze(frameResult.getFrames(), sourceText);
    persistVisualAnalysisAsset(job, visualResult, frameResult.getWarnings());
    return listActiveAssets(job.getId());
  }

  private boolean hasAutoTextAsset(List<ContentAnalysisAsset> assets) {
    if (assets == null || assets.isEmpty()) {
      return false;
    }
    for (ContentAnalysisAsset asset : assets) {
      if (asset == null) continue;
      if (asset.getIsDeleted() != null && asset.getIsDeleted() != 0) continue;
      String provider = normalizeString(asset.getStorageProvider()).toLowerCase(Locale.ROOT);
      if (!AUTO_ASSET_PROVIDER.equals(provider)) continue;
      if (!normalizeString(asset.getContentText()).isEmpty()) {
        return true;
      }
    }
    return false;
  }

  private boolean hasAutoFrameAsset(List<ContentAnalysisAsset> assets) {
    if (assets == null || assets.isEmpty()) {
      return false;
    }
    for (ContentAnalysisAsset asset : assets) {
      if (asset == null) continue;
      if (asset.getIsDeleted() != null && asset.getIsDeleted() != 0) continue;
      String provider = normalizeString(asset.getStorageProvider()).toLowerCase(Locale.ROOT);
      String assetType = normalizeString(asset.getAssetType()).toLowerCase(Locale.ROOT);
      if (AUTO_ASSET_PROVIDER.equals(provider) && "frame".equals(assetType)) {
        return true;
      }
    }
    return false;
  }

  private boolean hasVisualModelAsset(List<ContentAnalysisAsset> assets) {
    if (assets == null || assets.isEmpty()) {
      return false;
    }
    for (ContentAnalysisAsset asset : assets) {
      if (asset == null) continue;
      if (asset.getIsDeleted() != null && asset.getIsDeleted() != 0) continue;
      if (!AUTO_ASSET_PROVIDER.equals(normalizeString(asset.getStorageProvider()).toLowerCase(Locale.ROOT))) {
        continue;
      }
      Object metadata = parseJsonSafely(asset.getMetadataJson());
      if ("visual_model".equalsIgnoreCase(mapText(metadata, "source"))) {
        return true;
      }
    }
    return false;
  }

  private List<VideoFrameExtractionService.FrameAsset> buildFrameAssetsFromPersistedAssets(
    List<ContentAnalysisAsset> assets
  ) {
    if (assets == null || assets.isEmpty()) {
      return List.of();
    }
    List<VideoFrameExtractionService.FrameAsset> frames = new ArrayList<>();
    int index = 1;
    for (ContentAnalysisAsset asset : assets) {
      if (asset == null || (asset.getIsDeleted() != null && asset.getIsDeleted() != 0)) {
        continue;
      }
      if (!"frame".equalsIgnoreCase(normalizeString(asset.getAssetType()))) {
        continue;
      }
      if (!AUTO_ASSET_PROVIDER.equals(normalizeString(asset.getStorageProvider()).toLowerCase(Locale.ROOT))) {
        continue;
      }
      String filePath = normalizeString(asset.getStorageKey());
      if (filePath.isEmpty()) {
        Object metadata = parseJsonSafely(asset.getMetadataJson());
        filePath = mapText(metadata, "file_path", "filePath");
      }
      if (filePath.isEmpty()) {
        continue;
      }
      BigDecimal approxSec = asset.getDurationSec() == null
        ? BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP)
        : asset.getDurationSec().setScale(2, RoundingMode.HALF_UP);
      frames.add(new VideoFrameExtractionService.FrameAsset(index, approxSec, filePath, 0L));
      index += 1;
    }
    return frames;
  }

  private String collectAutoAssetText(List<ContentAnalysisAsset> assets) {
    if (assets == null || assets.isEmpty()) {
      return "";
    }
    return assets.stream()
      .filter(asset -> asset != null && (asset.getIsDeleted() == null || asset.getIsDeleted() == 0))
      .filter(asset -> AUTO_ASSET_PROVIDER.equals(normalizeString(asset.getStorageProvider()).toLowerCase(Locale.ROOT)))
      .map(ContentAnalysisAsset::getContentText)
      .map(this::normalizeString)
      .filter(text -> !text.isEmpty())
      .collect(Collectors.joining(" "));
  }

  private boolean hasSufficientMovementSignal(String sourceText) {
    String normalized = normalizeString(sourceText).toLowerCase(Locale.ROOT);
    if (normalized.isEmpty()) {
      return false;
    }
    List<List<String>> signalGroups = List.of(
      List.of("squat", "back squat", "front squat", "\u6df1\u8e72", "\u8e72"),
      List.of("deadlift", "hinge", "\u786c\u62c9", "\u9acb\u94f0\u94fe"),
      List.of("bench press", "chest press", "\u5367\u63a8"),
      List.of("push up", "push-up", "\u4fef\u5367\u6491", "\u4fef\u8eab\u6491"),
      List.of("pull up", "pull-up", "pullup", "chin up", "\u5f15\u4f53\u5411\u4e0a"),
      List.of("row", "\u5212\u8239"),
      List.of("lunge", "split squat", "\u5f13\u6b65", "\u7bad\u6b65", "\u5206\u817f\u8e72"),
      List.of("plank", "hollow", "\u5e73\u677f\u652f\u6491"),
      List.of("burpee", "\u6ce2\u6bd4"),
      List.of("jump rope", "skip rope", "\u8df3\u7ef3"),
      List.of("kettlebell swing", "swing", "\u58f6\u94c3\u6446\u52a8"),
      List.of("shoulder press", "overhead press", "\u63a8\u4e3e", "\u80a9\u63a8"),
      List.of("curl", "\u5f2f\u4e3e"),
      List.of("raise", "lateral raise", "\u4fa7\u5e73\u4e3e"),
      List.of("crunch", "sit up", "sit-up", "\u5377\u8179", "\u4ef0\u5367\u8d77\u5750"),
      List.of("stretch", "mobility", "\u62c9\u4f38", "\u6d3b\u52a8\u5ea6"),
      List.of("bridge", "glute bridge", "\u81c0\u6865"),
      List.of("carry", "\u884c\u8d70")
    );
    int matchedGroups = 0;
    for (List<String> group : signalGroups) {
      if (containsAny(normalized, group)) {
        matchedGroups += 1;
      }
      if (matchedGroups >= 3) {
        return true;
      }
    }
    return countCatalogMentions(normalized, 3) >= 3;
  }

  private int countCatalogMentions(String sourceText, int stopAt) {
    String normalizedText = normalizeForMatch(sourceText);
    if (normalizedText.length() < 8) {
      return 0;
    }
    int count = 0;
    Set<String> seen = new LinkedHashSet<>();
    for (ExerciseLite exercise : listActiveExercises(500)) {
      if (exercise == null || normalizeString(exercise.getName()).isEmpty()) {
        continue;
      }
      String normalizedName = normalizeForMatch(exercise.getName());
      if (normalizedName.length() < 7 || !seen.add(normalizedName)) {
        continue;
      }
      if (normalizedText.contains(normalizedName)) {
        count += 1;
        if (count >= stopAt) {
          return count;
        }
      }
    }
    return count;
  }

  private void persistFrameAsset(
    ContentAnalysisJob job,
    VideoFrameExtractionService.FrameAsset frame,
    Set<String> warnings
  ) {
    if (job == null || frame == null || normalizeString(frame.getFilePath()).isEmpty()) {
      return;
    }
    ContentAnalysisAsset asset = new ContentAnalysisAsset();
    LocalDateTime now = LocalDateTime.now();
    asset.setJobId(job.getId());
    asset.setAssetType("frame");
    asset.setStorageProvider(AUTO_ASSET_PROVIDER);
    asset.setStorageKey(frame.getFilePath());
    asset.setSourceUrl(normalizeString(job.getSourceUrl()).isEmpty() ? null : normalizeString(job.getSourceUrl()));
    asset.setContentText(
      "visual_keyframe index=%d approx_sec=%s pending_visual_model_analysis"
        .formatted(frame.getIndex(), frame.getApproxSec() == null ? "" : frame.getApproxSec().toPlainString())
    );
    asset.setDurationSec(frame.getApproxSec());
    asset.setMetadataJson(serializeJson(buildFrameMetadata(frame, warnings)));
    asset.setStatus(1);
    asset.setIsDeleted(0);
    asset.setCreateTime(now);
    asset.setUpdateTime(now);
    assetMapper.insert(asset);
  }

  private Map<String, Object> buildFrameMetadata(
    VideoFrameExtractionService.FrameAsset frame,
    Set<String> warnings
  ) {
    Map<String, Object> metadata = new LinkedHashMap<>();
    metadata.put("source", "auto_visual_frame_extractor");
    metadata.put("frame_index", frame.getIndex());
    metadata.put("approx_sec", frame.getApproxSec());
    metadata.put("file_path", frame.getFilePath());
    metadata.put("bytes", frame.getBytes());
    metadata.put("analysis_status", "pending_visual_model_analysis");
    metadata.put("warnings", warnings == null ? List.of() : List.copyOf(warnings));
    return metadata;
  }

  private void persistVisualAnalysisAsset(
    ContentAnalysisJob job,
    VideoVisualAnalysisService.VisualAnalysisResult visualResult,
    Set<String> frameWarnings
  ) {
    if (job == null || visualResult == null) {
      return;
    }
    String contentText = visualResult.hasObservations()
      ? buildVisualObservationText(visualResult.getObservations())
      : "visual_analysis_no_reliable_movement_labels";
    Map<String, Object> metadata = new LinkedHashMap<>();
    metadata.put("source", "visual_model");
    metadata.put("analysis_status", visualResult.hasObservations() ? "movement_labels_ready" : "no_reliable_labels");
    metadata.put("observations", visualResult.getObservations().stream().map(this::visualObservationToMap).toList());
    metadata.put("raw_content", truncate(visualResult.getRawContent(), 1500));
    metadata.put("warnings", visualResult.getWarnings());
    metadata.put("frame_warnings", frameWarnings == null ? List.of() : List.copyOf(frameWarnings));
    persistAutoExtractionAsset(
      job.getId(),
      "manual_note",
      job.getSourceUrl(),
      contentText,
      metadata
    );
  }

  private String buildVisualObservationText(List<VideoVisualAnalysisService.MovementObservation> observations) {
    if (observations == null || observations.isEmpty()) {
      return "";
    }
    return observations.stream()
      .map(item ->
        "visual_movement frame=%d start=%s end=%s movement=%s phase=%s equipment=%s body_region=%s sets=%d reps=%d time_seconds=%d confidence=%s evidence=%s"
          .formatted(
            item.getFrameIndex(),
            item.getStartSec() == null ? "" : item.getStartSec().toPlainString(),
            item.getEndSec() == null ? "" : item.getEndSec().toPlainString(),
            item.getMovementName(),
            item.getPhase(),
            item.getEquipment(),
            item.getBodyRegion(),
            item.getSets(),
            item.getReps(),
            item.getTimeSeconds(),
            item.getConfidence() == null ? "" : item.getConfidence().toPlainString(),
            item.getEvidence()
          )
      )
      .collect(Collectors.joining("\n"));
  }

  private Map<String, Object> visualObservationToMap(VideoVisualAnalysisService.MovementObservation item) {
    Map<String, Object> row = new LinkedHashMap<>();
    row.put("frame_index", item.getFrameIndex());
    row.put("start_sec", item.getStartSec());
    row.put("end_sec", item.getEndSec());
    row.put("movement_name", item.getMovementName());
    row.put("phase", item.getPhase());
    row.put("equipment", item.getEquipment());
    row.put("body_region", item.getBodyRegion());
    row.put("sets", item.getSets());
    row.put("reps", item.getReps());
    row.put("time_seconds", item.getTimeSeconds());
    row.put("confidence", item.getConfidence());
    row.put("evidence", item.getEvidence());
    return row;
  }

  private Map<String, Object> buildAutoSummaryMetadata(VideoLinkAutoExtractor.ExtractionResult extracted) {
    Map<String, Object> metadata = new LinkedHashMap<>();
    metadata.put("source", "auto_extractor");
    metadata.put("title", extracted.getTitle());
    metadata.put("uploader", extracted.getUploader());
    metadata.put("duration_sec", extracted.getDurationSec());
    metadata.put("tags", extracted.getTags());
    metadata.put("warnings", extracted.getWarnings());
    return metadata;
  }

  private void persistAutoExtractionAsset(
    Long jobId,
    String assetType,
    String sourceUrl,
    String contentText,
    Object metadata
  ) {
    String safeText = normalizeString(contentText);
    if (jobId == null || jobId <= 0 || safeText.isEmpty()) {
      return;
    }

    ContentAnalysisAsset asset = new ContentAnalysisAsset();
    LocalDateTime now = LocalDateTime.now();
    asset.setJobId(jobId);
    asset.setAssetType(assetType);
    asset.setStorageProvider(AUTO_ASSET_PROVIDER);
    asset.setStorageKey(null);
    asset.setSourceUrl(normalizeString(sourceUrl).isEmpty() ? null : normalizeString(sourceUrl));
    asset.setContentText(safeText);
    asset.setDurationSec(null);
    asset.setMetadataJson(serializeJson(metadata));
    asset.setStatus(1);
    asset.setIsDeleted(0);
    asset.setCreateTime(now);
    asset.setUpdateTime(now);
    assetMapper.insert(asset);
  }

  private void softDeleteCandidates(Long jobId) {
    candidateMapper.update(
      null,
      new LambdaUpdateWrapper<ContentMovementCandidate>()
        .eq(ContentMovementCandidate::getJobId, jobId)
        .eq(ContentMovementCandidate::getIsDeleted, 0)
        .set(ContentMovementCandidate::getIsDeleted, 1)
        .set(ContentMovementCandidate::getUpdateTime, LocalDateTime.now())
    );
  }

  private void softDeleteMappings(Long jobId) {
    mappingMapper.update(
      null,
      new LambdaUpdateWrapper<ContentExerciseMapping>()
        .eq(ContentExerciseMapping::getJobId, jobId)
        .eq(ContentExerciseMapping::getIsDeleted, 0)
        .set(ContentExerciseMapping::getIsDeleted, 1)
        .set(ContentExerciseMapping::getUpdateTime, LocalDateTime.now())
    );
  }

  private void softDeletePlans(Long jobId) {
    planDraftMapper.update(
      null,
      new LambdaUpdateWrapper<ContentPlanDraft>()
        .eq(ContentPlanDraft::getJobId, jobId)
        .eq(ContentPlanDraft::getIsDeleted, 0)
        .set(ContentPlanDraft::getIsDeleted, 1)
        .set(ContentPlanDraft::getUpdateTime, LocalDateTime.now())
    );
  }

  private List<GeneratedCandidateSeed> generateCandidateSeeds(
    String sourceText,
    String goalType,
    Map<String, Object> insight
  ) {
    if (sourceText == null || sourceText.isBlank()) {
      return new ArrayList<>();
    }
    String normalized = sourceText.toLowerCase(Locale.ROOT);
    int desiredCount = "module".equals(goalType) ? 4 : 7;

    List<GeneratedCandidateSeed> seeds = new ArrayList<>();
    List<KeywordRule> rules = List.of(
      new KeywordRule("Back Squat", List.of("squat", "back squat", "\u6df1\u8e72", "\u6760\u94c3\u6df1\u8e72")),
      new KeywordRule("Deadlift", List.of("deadlift", "hinge", "\u786c\u62c9", "\u9acb\u94f0\u94fe")),
      new KeywordRule("Bench Press", List.of("bench press", "chest press", "\u5367\u63a8", "\u5e73\u677f\u5367\u63a8")),
      new KeywordRule("Push-Up", List.of("push up", "push-up", "\u4fef\u5367\u6491", "\u4fef\u8eab\u6491")),
      new KeywordRule("Pull-Up", List.of("pull up", "pull-up", "pullup", "chin up", "\u5f15\u4f53\u5411\u4e0a")),
      new KeywordRule("Lunge", List.of("lunge", "split squat", "\u5f13\u6b65", "\u7bad\u6b65\u8e72", "\u5206\u817f\u8e72")),
      new KeywordRule("Plank", List.of("plank", "core brace", "hollow", "\u5e73\u677f\u652f\u6491", "\u6838\u5fc3\u652f\u6491")),
      new KeywordRule("Burpee", List.of("burpee", "\u6ce2\u6bd4", "\u6ce2\u6bd4\u8df3")),
      new KeywordRule("Jump Rope", List.of("jump rope", "rope skip", "\u8df3\u7ef3")),
      new KeywordRule("Kettlebell Swing", List.of("kettlebell swing", "\u58f6\u94c3\u6446\u52a8")),
      new KeywordRule("Dumbbell Shoulder Press", List.of("shoulder press", "dumbbell press", "\u54d1\u94c3\u63a8\u4e3e", "\u80a9\u63a8")),
      new KeywordRule("One-Arm Dumbbell Row", List.of("dumbbell row", "one-arm row", "\u54d1\u94c3\u5212\u8239", "\u5355\u81c2\u5212\u8239")),
      new KeywordRule("Lateral Raise", List.of("lateral raise", "\u4fa7\u5e73\u4e3e")),
      new KeywordRule("Face Pull", List.of("face pull", "\u9762\u62c9")),
      new KeywordRule("Crunch", List.of("crunch", "\u5377\u8179")),
      new KeywordRule("Sit-Up", List.of("sit up", "sit-up", "\u4ef0\u5367\u8d77\u5750")),
      new KeywordRule("Glute Bridge", List.of("glute bridge", "hip bridge", "\u81c0\u6865")),
      new KeywordRule("Ankle Mobility", List.of("ankle mobility", "dorsiflexion", "\u8e1d\u5173\u8282\u6d3b\u52a8", "\u8db3\u80cc\u5c48")),
      new KeywordRule("Hip Flexor Stretch", List.of("hip flexor stretch", "\u9acb\u5c48\u808c\u62c9\u4f38")),
      new KeywordRule("Thoracic Rotation", List.of("thoracic rotation", "\u80f8\u690e\u65cb\u8f6c"))
    );

    for (KeywordRule rule : rules) {
      int matchIndex = firstKeywordIndex(normalized, rule.keywords);
      if (matchIndex < 0) {
        continue;
      }
      seeds.add(new GeneratedCandidateSeed(
        rule.label,
        estimateStartSecFromTextIndex(matchIndex, normalized.length()),
        estimateEndSecFromTextIndex(matchIndex, normalized.length()),
        BigDecimal.valueOf(Math.max(58, 90 - seeds.size() * 5L)).setScale(2, RoundingMode.HALF_UP),
        "keyword-match"
      ));
      if (seeds.size() >= desiredCount) {
        break;
      }
    }

    if (seeds.size() < desiredCount) {
      seeds.addAll(extractCatalogMentionSeeds(sourceText, desiredCount - seeds.size(), seeds));
    }

    List<GeneratedCandidateSeed> deduped = deduplicateSeeds(seeds);
    if (deduped.size() > desiredCount) {
      return deduped.subList(0, desiredCount);
    }
    return deduped;
  }

  private List<GeneratedCandidateSeed> generateVisualObservationSeeds(
    List<ContentAnalysisAsset> assets,
    String goalType
  ) {
    if (assets == null || assets.isEmpty()) {
      return List.of();
    }
    int desiredCount = "module".equals(goalType) ? 8 : 16;
    List<GeneratedCandidateSeed> seeds = new ArrayList<>();
    for (ContentAnalysisAsset asset : assets) {
      if (asset == null || (asset.getIsDeleted() != null && asset.getIsDeleted() != 0)) {
        continue;
      }
      if (!AUTO_ASSET_PROVIDER.equals(normalizeString(asset.getStorageProvider()).toLowerCase(Locale.ROOT))) {
        continue;
      }
      Object metadata = parseJsonSafely(asset.getMetadataJson());
      if (!"visual_model".equalsIgnoreCase(mapText(metadata, "source"))) {
        continue;
      }
      Map<String, Object> metadataMap = toObjectMap(metadata);
      List<Map<String, Object>> observations = toObjectMapList(metadataMap.get("observations"));
      for (Map<String, Object> observation : observations) {
        String movementName = firstNonBlank(
          mapText(observation, "movement_name", "movementName", "name"),
          ""
        );
        if (movementName.isBlank() || isGenericPlanExerciseName(movementName)) {
          continue;
        }
        BigDecimal confidence = readDecimalFromMap(observation, BigDecimal.valueOf(60), "confidence");
        if (confidence.compareTo(BigDecimal.valueOf(45)) < 0) {
          continue;
        }
        BigDecimal startSec = readDecimalFromMap(observation, BigDecimal.ZERO, "start_sec", "startSec");
        BigDecimal endSec = readDecimalFromMap(observation, BigDecimal.ZERO, "end_sec", "endSec");
        if (endSec.compareTo(startSec) <= 0) {
          endSec = startSec.add(BigDecimal.valueOf(12)).setScale(2, RoundingMode.HALF_UP);
        }
        String reason = "visual-keyframe";
        String phase = mapText(observation, "phase");
        String equipment = mapText(observation, "equipment");
        String bodyRegion = mapText(observation, "body_region", "bodyRegion");
        String evidence = mapText(observation, "evidence");
        if (!phase.isBlank()) {
          reason += " phase=" + phase;
        }
        if (!equipment.isBlank()) {
          reason += " equipment=" + equipment;
        }
        if (!bodyRegion.isBlank()) {
          reason += " body_region=" + bodyRegion;
        }
        int sets = readIntFromMap(observation, 0, "sets");
        int reps = readIntFromMap(observation, 0, "reps");
        int timeSeconds = readIntFromMap(observation, 0, "time_seconds", "timeSeconds");
        if (sets > 0) {
          reason += " sets=" + sets;
        }
        if (reps > 0) {
          reason += " reps=" + reps;
        }
        if (timeSeconds > 0) {
          reason += " time_seconds=" + timeSeconds;
        }
        if (!evidence.isBlank()) {
          reason += " evidence=" + truncate(evidence, 80);
        }
        seeds.add(new GeneratedCandidateSeed(
          movementName,
          startSec,
          endSec,
          confidence.setScale(2, RoundingMode.HALF_UP),
          reason
        ));
        if (seeds.size() >= desiredCount) {
          return deduplicateSeeds(seeds);
        }
      }
    }
    return deduplicateSeeds(seeds);
  }

  private int firstKeywordIndex(String source, List<String> keywords) {
    if (source == null || source.isBlank() || keywords == null || keywords.isEmpty()) {
      return -1;
    }
    int best = -1;
    for (String keyword : keywords) {
      String normalizedKeyword = normalizeString(keyword).toLowerCase(Locale.ROOT);
      if (normalizedKeyword.isEmpty()) {
        continue;
      }
      int index = source.indexOf(normalizedKeyword);
      if (index >= 0 && (best < 0 || index < best)) {
        best = index;
      }
    }
    return best;
  }

  private BigDecimal estimateStartSecFromTextIndex(int matchIndex, int textLength) {
    if (textLength <= 0 || matchIndex <= 0) {
      return BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP);
    }
    double ratio = Math.max(0d, Math.min(1d, (double) matchIndex / (double) textLength));
    return BigDecimal.valueOf(Math.round(ratio * 180d)).setScale(2, RoundingMode.HALF_UP);
  }

  private BigDecimal estimateEndSecFromTextIndex(int matchIndex, int textLength) {
    return estimateStartSecFromTextIndex(matchIndex, textLength)
      .add(BigDecimal.valueOf(25))
      .setScale(2, RoundingMode.HALF_UP);
  }

  private List<GeneratedCandidateSeed> extractCatalogMentionSeeds(
    String sourceText,
    int limit,
    List<GeneratedCandidateSeed> existing
  ) {
    if (sourceText == null || sourceText.isBlank() || limit <= 0) {
      return List.of();
    }
    String normalizedText = normalizeForMatch(sourceText);
    if (normalizedText.length() < 8) {
      return List.of();
    }
    Set<String> existingLabels = existing == null
      ? new LinkedHashSet<>()
      : existing.stream()
        .map(item -> normalizeForMatch(item == null ? null : item.label))
        .filter(text -> !text.isEmpty())
        .collect(Collectors.toCollection(LinkedHashSet::new));

    List<GeneratedCandidateSeed> result = new ArrayList<>();
    for (ExerciseLite exercise : listActiveExercises(500)) {
      if (exercise == null || normalizeString(exercise.getName()).isEmpty()) {
        continue;
      }
      String exerciseName = normalizeString(exercise.getName());
      String normalizedName = normalizeForMatch(exerciseName);
      if (normalizedName.length() < 7 || existingLabels.contains(normalizedName)) {
        continue;
      }
      int index = normalizedText.indexOf(normalizedName);
      if (index < 0) {
        continue;
      }
      result.add(new GeneratedCandidateSeed(
        exerciseName,
        estimateStartSecFromTextIndex(index, normalizedText.length()),
        estimateEndSecFromTextIndex(index, normalizedText.length()),
        BigDecimal.valueOf(82 - Math.min(18, result.size() * 3L)).setScale(2, RoundingMode.HALF_UP),
        "catalog-mention"
      ));
      existingLabels.add(normalizedName);
      if (result.size() >= limit) {
        break;
      }
    }
    return result;
  }

  private List<GeneratedCandidateSeed> fallbackSeeds(String goalType, Map<String, Object> insight) {
    String style = insight == null ? "" : normalizeString(readInsightString(insight, "style_hint"));
    List<GeneratedCandidateSeed> styleSeeds = styleFallbackSeeds(style, goalType);
    if (!styleSeeds.isEmpty()) {
      return styleSeeds;
    }

    if ("module".equals(goalType)) {
      return List.of(
        new GeneratedCandidateSeed("Goblet Squat", BigDecimal.ZERO, BigDecimal.valueOf(25), BigDecimal.valueOf(74), "fallback"),
        new GeneratedCandidateSeed("Push-Up", BigDecimal.valueOf(25), BigDecimal.valueOf(50), BigDecimal.valueOf(71), "fallback"),
        new GeneratedCandidateSeed("Bent-over Row", BigDecimal.valueOf(50), BigDecimal.valueOf(75), BigDecimal.valueOf(69), "fallback"),
        new GeneratedCandidateSeed("Plank", BigDecimal.valueOf(75), BigDecimal.valueOf(95), BigDecimal.valueOf(67), "fallback")
      );
    }

    return List.of(
      new GeneratedCandidateSeed("Back Squat", BigDecimal.ZERO, BigDecimal.valueOf(40), BigDecimal.valueOf(82), "fallback"),
      new GeneratedCandidateSeed("Bench Press", BigDecimal.valueOf(40), BigDecimal.valueOf(80), BigDecimal.valueOf(79), "fallback"),
      new GeneratedCandidateSeed("Deadlift", BigDecimal.valueOf(80), BigDecimal.valueOf(120), BigDecimal.valueOf(76), "fallback"),
      new GeneratedCandidateSeed("Lunge", BigDecimal.valueOf(120), BigDecimal.valueOf(155), BigDecimal.valueOf(72), "fallback"),
      new GeneratedCandidateSeed("Plank", BigDecimal.valueOf(155), BigDecimal.valueOf(180), BigDecimal.valueOf(70), "fallback")
    );
  }

  private List<GeneratedCandidateSeed> deduplicateSeeds(List<GeneratedCandidateSeed> seeds) {
    Map<String, List<BigDecimal>> seenStartsByLabel = new LinkedHashMap<>();
    List<GeneratedCandidateSeed> deduped = new ArrayList<>();
    for (GeneratedCandidateSeed seed : seeds) {
      if (seed == null || normalizeString(seed.label).isEmpty()) {
        continue;
      }
      String key = normalizeForMatch(seed.label);
      if (key.isEmpty()) {
        key = seed.label.toLowerCase(Locale.ROOT).trim();
      }
      BigDecimal start = seed.startSec == null ? BigDecimal.ZERO : seed.startSec;
      List<BigDecimal> starts = seenStartsByLabel.computeIfAbsent(key, ignored -> new ArrayList<>());
      boolean nearDuplicate = false;
      for (BigDecimal previousStart : starts) {
        if (previousStart == null) {
          continue;
        }
        BigDecimal distance = start.subtract(previousStart).abs();
        if (distance.compareTo(BigDecimal.valueOf(12)) <= 0) {
          nearDuplicate = true;
          break;
        }
      }
      if (nearDuplicate) {
        continue;
      }
      starts.add(start);
      deduped.add(seed);
    }
    return deduped;
  }

  private Map<String, Object> buildAnalysisSummary(
    String mergedText,
    List<ContentMovementCandidate> candidates,
    Map<String, Object> insight
  ) {
    Map<String, Object> payload = new LinkedHashMap<>();
    payload.put("analysis_text_preview", truncate(mergedText, 260));
    if (insight != null && !insight.isEmpty()) {
      payload.putAll(insight);
    }
    payload.put("candidate_count", candidates == null ? 0 : candidates.size());
    payload.put(
      "candidates",
      candidates == null
        ? List.of()
        : candidates.stream().map(item -> {
          Map<String, Object> row = new LinkedHashMap<>();
          row.put("id", item.getId());
          row.put("label", item.getNormalizedLabel());
          row.put("confidence", item.getConfidence());
          return row;
        }).toList()
    );
    return payload;
  }

  private Map<String, Object> buildContentInsight(
    ContentAnalysisJob job,
    List<ContentAnalysisAsset> assets,
    String mergedText
  ) {
    String safeText = normalizeString(mergedText);
    String requestText = normalizeString(job == null ? null : job.getRequestPayload());
    String sourceUrl = normalizeString(job == null ? null : job.getSourceUrl());
    String sourceVideoId = normalizeString(job == null ? null : job.getSourceVideoId());
    String insightText = (safeText + " " + requestText + " " + sourceUrl + " " + sourceVideoId).trim();
    String normalized = insightText.toLowerCase(Locale.ROOT);
    List<String> sentences = splitInsightSentences(insightText);
    List<String> focusTerms = extractFocusTerms(normalized);
    List<String> equipmentHints = extractEquipmentHints(normalized);
    List<String> riskFlags = extractRiskFlags(normalized);
    String style = inferContentStyle(normalized);
    String contentType = inferContentType(style, normalized);
    String planTypeHint = inferPlanTypeHint(style, contentType, focusTerms, sentences, job);
    List<Map<String, Object>> segmentClues = buildSegmentClues(sentences, normalized, style, contentType);

    Map<String, Object> payload = new LinkedHashMap<>();
    payload.put("source_platform", job == null ? null : job.getSourcePlatform());
    payload.put("source_video_id", job == null ? null : job.getSourceVideoId());
    payload.put("requested_plan_type", job == null ? null : normalizePlanType(job.getGoalType(), "course"));
    payload.put("plan_type_hint", planTypeHint);
    payload.put("style_hint", style);
    payload.put("content_type", contentType);
    payload.put("focus_terms", focusTerms);
    payload.put("equipment_hints", equipmentHints);
    payload.put("risk_flags", riskFlags);
    payload.put("segment_clues", segmentClues);
    payload.put("asset_count", assets == null ? 0 : assets.size());
    payload.put("visual_frame_count", countVisualFrameAssets(assets));
    payload.put("visual_frames", buildVisualFrameSummary(assets));
    payload.put("sentence_count", sentences.size());
    payload.put("text_length", insightText.length());
    payload.put("text_preview", truncate(insightText, 320));
    payload.put(
      "summary",
      buildInsightSummary(style, contentType, focusTerms, equipmentHints, riskFlags, planTypeHint)
    );
    return payload;
  }

  private int countVisualFrameAssets(List<ContentAnalysisAsset> assets) {
    if (assets == null || assets.isEmpty()) {
      return 0;
    }
    int count = 0;
    for (ContentAnalysisAsset asset : assets) {
      if (asset == null || (asset.getIsDeleted() != null && asset.getIsDeleted() != 0)) {
        continue;
      }
      if ("frame".equalsIgnoreCase(normalizeString(asset.getAssetType()))
        && AUTO_ASSET_PROVIDER.equals(normalizeString(asset.getStorageProvider()).toLowerCase(Locale.ROOT))) {
        count += 1;
      }
    }
    return count;
  }

  private List<Map<String, Object>> buildVisualFrameSummary(List<ContentAnalysisAsset> assets) {
    if (assets == null || assets.isEmpty()) {
      return List.of();
    }
    List<Map<String, Object>> frames = new ArrayList<>();
    for (ContentAnalysisAsset asset : assets) {
      if (asset == null || (asset.getIsDeleted() != null && asset.getIsDeleted() != 0)) {
        continue;
      }
      if (!"frame".equalsIgnoreCase(normalizeString(asset.getAssetType()))) {
        continue;
      }
      if (!AUTO_ASSET_PROVIDER.equals(normalizeString(asset.getStorageProvider()).toLowerCase(Locale.ROOT))) {
        continue;
      }
      Map<String, Object> frame = new LinkedHashMap<>();
      frame.put("asset_id", asset.getId());
      frame.put("storage_key", asset.getStorageKey());
      frame.put("approx_sec", asset.getDurationSec());
      frame.put("metadata", parseJsonSafely(asset.getMetadataJson()));
      frames.add(frame);
      if (frames.size() >= 12) {
        break;
      }
    }
    return frames;
  }

  private String buildResultSummary(Map<String, Object> insight, int candidateCount) {
    String style = readInsightString(insight, "style_hint");
    String contentType = readInsightString(insight, "content_type");
    String focus = joinInsightList(insight, "focus_terms", 3);
    String base = style.isEmpty() ? contentType : style + " / " + contentType;
    if (base.isBlank()) {
      base = "Video";
    }
    if (!focus.isBlank()) {
      base = base + " focus: " + focus;
    }
    return "%s. %d candidates ready for review.".formatted(base, candidateCount);
  }

  private String buildInsightSummary(
    String style,
    String contentType,
    List<String> focusTerms,
    List<String> equipmentHints,
    List<String> riskFlags,
    String planTypeHint
  ) {
    String focus = focusTerms == null || focusTerms.isEmpty()
      ? "general movement quality"
      : String.join(", ", focusTerms.subList(0, Math.min(4, focusTerms.size())));
    String equipment = equipmentHints == null || equipmentHints.isEmpty()
      ? "bodyweight first"
      : String.join(", ", equipmentHints.subList(0, Math.min(3, equipmentHints.size())));
    String risk = riskFlags == null || riskFlags.isEmpty()
      ? "no explicit risk flags"
      : String.join(", ", riskFlags.subList(0, Math.min(3, riskFlags.size())));
    String type = contentType == null || contentType.isBlank() ? "session" : contentType;
    String styleLabel = style == null || style.isBlank() ? "General" : style;
    String plan = planTypeHint == null || planTypeHint.isBlank() ? "course" : planTypeHint;
    return "%s %s detected. Focus: %s. Equipment: %s. Risk: %s. Plan hint: %s."
      .formatted(styleLabel, type, focus, equipment, risk, plan);
  }

  private List<GeneratedCandidateSeed> styleFallbackSeeds(String style, String goalType) {
    String normalizedStyle = canonicalStyle(style);
    List<GeneratedCandidateSeed> seeds = switch (normalizedStyle) {
      case "Bodybuilding" -> List.of(
        new GeneratedCandidateSeed("Bench Press", BigDecimal.ZERO, BigDecimal.valueOf(28), BigDecimal.valueOf(84), "style-fallback"),
        new GeneratedCandidateSeed("Lat Pulldown", BigDecimal.valueOf(28), BigDecimal.valueOf(56), BigDecimal.valueOf(82), "style-fallback"),
        new GeneratedCandidateSeed("Goblet Squat", BigDecimal.valueOf(56), BigDecimal.valueOf(84), BigDecimal.valueOf(79), "style-fallback"),
        new GeneratedCandidateSeed("Romanian Deadlift", BigDecimal.valueOf(84), BigDecimal.valueOf(112), BigDecimal.valueOf(77), "style-fallback"),
        new GeneratedCandidateSeed("Lateral Raise", BigDecimal.valueOf(112), BigDecimal.valueOf(138), BigDecimal.valueOf(75), "style-fallback"),
        new GeneratedCandidateSeed("Face Pull", BigDecimal.valueOf(138), BigDecimal.valueOf(160), BigDecimal.valueOf(74), "style-fallback")
      );
      case "CrossFit" -> List.of(
        new GeneratedCandidateSeed("Thruster", BigDecimal.ZERO, BigDecimal.valueOf(28), BigDecimal.valueOf(84), "style-fallback"),
        new GeneratedCandidateSeed("Pull-Up", BigDecimal.valueOf(28), BigDecimal.valueOf(56), BigDecimal.valueOf(82), "style-fallback"),
        new GeneratedCandidateSeed("Box Jump", BigDecimal.valueOf(56), BigDecimal.valueOf(84), BigDecimal.valueOf(79), "style-fallback"),
        new GeneratedCandidateSeed("Double Under", BigDecimal.valueOf(84), BigDecimal.valueOf(112), BigDecimal.valueOf(77), "style-fallback"),
        new GeneratedCandidateSeed("Row", BigDecimal.valueOf(112), BigDecimal.valueOf(140), BigDecimal.valueOf(75), "style-fallback"),
        new GeneratedCandidateSeed("Kettlebell Swing", BigDecimal.valueOf(140), BigDecimal.valueOf(165), BigDecimal.valueOf(74), "style-fallback")
      );
      case "Functional" -> List.of(
        new GeneratedCandidateSeed("Goblet Squat", BigDecimal.ZERO, BigDecimal.valueOf(24), BigDecimal.valueOf(83), "style-fallback"),
        new GeneratedCandidateSeed("Split Squat", BigDecimal.valueOf(24), BigDecimal.valueOf(48), BigDecimal.valueOf(80), "style-fallback"),
        new GeneratedCandidateSeed("Push-Up", BigDecimal.valueOf(48), BigDecimal.valueOf(72), BigDecimal.valueOf(78), "style-fallback"),
        new GeneratedCandidateSeed("Pallof Press", BigDecimal.valueOf(72), BigDecimal.valueOf(96), BigDecimal.valueOf(76), "style-fallback"),
        new GeneratedCandidateSeed("Carry", BigDecimal.valueOf(96), BigDecimal.valueOf(120), BigDecimal.valueOf(74), "style-fallback"),
        new GeneratedCandidateSeed("Dead Bug", BigDecimal.valueOf(120), BigDecimal.valueOf(145), BigDecimal.valueOf(73), "style-fallback")
      );
      case "Mobility / Yoga" -> List.of(
        new GeneratedCandidateSeed("Ankle Mobility", BigDecimal.ZERO, BigDecimal.valueOf(20), BigDecimal.valueOf(83), "style-fallback"),
        new GeneratedCandidateSeed("Hip Flexor Stretch", BigDecimal.valueOf(20), BigDecimal.valueOf(40), BigDecimal.valueOf(81), "style-fallback"),
        new GeneratedCandidateSeed("Thoracic Rotation", BigDecimal.valueOf(40), BigDecimal.valueOf(60), BigDecimal.valueOf(79), "style-fallback"),
        new GeneratedCandidateSeed("Deep Squat Hold", BigDecimal.valueOf(60), BigDecimal.valueOf(80), BigDecimal.valueOf(77), "style-fallback"),
        new GeneratedCandidateSeed("Shoulder CAR", BigDecimal.valueOf(80), BigDecimal.valueOf(100), BigDecimal.valueOf(75), "style-fallback"),
        new GeneratedCandidateSeed("World's Greatest Stretch", BigDecimal.valueOf(100), BigDecimal.valueOf(120), BigDecimal.valueOf(74), "style-fallback")
      );
      case "Rehab" -> List.of(
        new GeneratedCandidateSeed("Ankle CAR", BigDecimal.ZERO, BigDecimal.valueOf(20), BigDecimal.valueOf(84), "style-fallback"),
        new GeneratedCandidateSeed("Glute Bridge", BigDecimal.valueOf(20), BigDecimal.valueOf(40), BigDecimal.valueOf(82), "style-fallback"),
        new GeneratedCandidateSeed("Bird Dog", BigDecimal.valueOf(40), BigDecimal.valueOf(60), BigDecimal.valueOf(80), "style-fallback"),
        new GeneratedCandidateSeed("Dead Bug", BigDecimal.valueOf(60), BigDecimal.valueOf(80), BigDecimal.valueOf(78), "style-fallback"),
        new GeneratedCandidateSeed("Side Plank", BigDecimal.valueOf(80), BigDecimal.valueOf(100), BigDecimal.valueOf(76), "style-fallback"),
        new GeneratedCandidateSeed("Wall Slide", BigDecimal.valueOf(100), BigDecimal.valueOf(120), BigDecimal.valueOf(74), "style-fallback")
      );
      case "Athletic" -> List.of(
        new GeneratedCandidateSeed("Sprint Drill", BigDecimal.ZERO, BigDecimal.valueOf(24), BigDecimal.valueOf(84), "style-fallback"),
        new GeneratedCandidateSeed("Jump Landing", BigDecimal.valueOf(24), BigDecimal.valueOf(48), BigDecimal.valueOf(82), "style-fallback"),
        new GeneratedCandidateSeed("Lateral Shuffle", BigDecimal.valueOf(48), BigDecimal.valueOf(72), BigDecimal.valueOf(80), "style-fallback"),
        new GeneratedCandidateSeed("Med Ball Throw", BigDecimal.valueOf(72), BigDecimal.valueOf(96), BigDecimal.valueOf(78), "style-fallback"),
        new GeneratedCandidateSeed("A-Skip Drill", BigDecimal.valueOf(96), BigDecimal.valueOf(120), BigDecimal.valueOf(76), "style-fallback"),
        new GeneratedCandidateSeed("Deceleration Lunge", BigDecimal.valueOf(120), BigDecimal.valueOf(145), BigDecimal.valueOf(74), "style-fallback")
      );
      case "Strength & Conditioning" -> List.of(
        new GeneratedCandidateSeed("Deadlift", BigDecimal.ZERO, BigDecimal.valueOf(30), BigDecimal.valueOf(84), "style-fallback"),
        new GeneratedCandidateSeed("Kettlebell Swing", BigDecimal.valueOf(30), BigDecimal.valueOf(60), BigDecimal.valueOf(82), "style-fallback"),
        new GeneratedCandidateSeed("Jump Rope", BigDecimal.valueOf(60), BigDecimal.valueOf(90), BigDecimal.valueOf(79), "style-fallback"),
        new GeneratedCandidateSeed("Burpee", BigDecimal.valueOf(90), BigDecimal.valueOf(120), BigDecimal.valueOf(77), "style-fallback"),
        new GeneratedCandidateSeed("Plank", BigDecimal.valueOf(120), BigDecimal.valueOf(145), BigDecimal.valueOf(75), "style-fallback"),
        new GeneratedCandidateSeed("Farmer Carry", BigDecimal.valueOf(145), BigDecimal.valueOf(170), BigDecimal.valueOf(74), "style-fallback")
      );
      default -> List.of();
    };

    if (seeds.isEmpty()) {
      return seeds;
    }
    if ("module".equals(goalType) && seeds.size() > 4) {
      return List.copyOf(seeds.subList(0, 4));
    }
    return seeds;
  }

  private List<String> splitInsightSentences(String text) {
    if (text == null || text.isBlank()) {
      return List.of();
    }
    String normalized = text.replace('\r', ' ').trim();
    String[] parts = normalized.split("(?<=[。！？.!?;；])\\s*|\\n+");
    List<String> sentences = new ArrayList<>();
    for (String part : parts) {
      String value = normalizeString(part);
      if (!value.isEmpty()) {
        sentences.add(value);
      }
    }
    if (sentences.isEmpty()) {
      sentences.add(normalizeString(text));
    }
    return sentences;
  }

  private List<Map<String, Object>> buildSegmentClues(
    List<String> sentences,
    String normalizedText,
    String style,
    String contentType
  ) {
    List<Map<String, Object>> clues = new ArrayList<>();
    if (sentences != null) {
      for (int i = 0; i < sentences.size() && clues.size() < 6; i += 1) {
        String sentence = normalizeString(sentences.get(i));
        String label = detectSegmentLabel(sentence.toLowerCase(Locale.ROOT));
        if (label.isEmpty()) {
          continue;
        }
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("order", i + 1);
        row.put("label", label);
        row.put("evidence", truncate(sentence, 160));
        row.put("confidence", segmentConfidence(label, style, contentType));
        clues.add(row);
      }
    }

    if (clues.isEmpty() && normalizedText != null && !normalizedText.isBlank()) {
      Map<String, Object> row = new LinkedHashMap<>();
      row.put("order", 1);
      row.put("label", firstNonBlank(contentType, style, "Overview"));
      row.put("evidence", truncate(normalizedText, 160));
      row.put("confidence", 72);
      clues.add(row);
    }
    return clues;
  }

  private String detectSegmentLabel(String sentence) {
    if (sentence == null || sentence.isBlank()) {
      return "";
    }
    if (containsAny(sentence, List.of("warmup", "warm up", "activation", "prep", "prepare", "热身", "准备"))) {
      return "Warmup / Activation";
    }
    if (containsAny(sentence, List.of("mobility", "stretch", "flow", "flexibility", "拉伸", "活动"))) {
      return "Mobility";
    }
    if (containsAny(sentence, List.of("technique", "form", "cue", "alignment", "tempo", "控制", "动作"))) {
      return "Technique / Control";
    }
    if (containsAny(sentence, List.of("strength", "load", "heavy", "set", "rep", "compound", "hypertrophy", "力量", "增肌"))) {
      return "Strength";
    }
    if (containsAny(sentence, List.of("circuit", "conditioning", "wod", "amrap", "emom", "metcon", "cardio", "interval", "有氧", "燃脂"))) {
      return "Conditioning";
    }
    if (containsAny(sentence, List.of("power", "explosive", "speed", "jump", "sprint", "爆发"))) {
      return "Power / Speed";
    }
    if (containsAny(sentence, List.of("rehab", "injury", "pain", "corrective", "stability", "康复", "恢复"))) {
      return "Corrective / Rehab";
    }
    if (containsAny(sentence, List.of("cooldown", "cool down", "breathing", "recover", "relax", "放松", "呼吸"))) {
      return "Cooldown / Recovery";
    }
    return "";
  }

  private int segmentConfidence(String label, String style, String contentType) {
    String normalized = (label + " " + style + " " + contentType).toLowerCase(Locale.ROOT);
    if (normalized.contains("rehab") || normalized.contains("corrective")) {
      return 84;
    }
    if (normalized.contains("condition")) {
      return 80;
    }
    if (normalized.contains("strength")) {
      return 78;
    }
    if (normalized.contains("mobility")) {
      return 76;
    }
    return 74;
  }

  private String inferContentStyle(String normalizedText) {
    if (containsAny(normalizedText, List.of("hypertrophy", "bodybuilding", "pump", "muscle", "增肌", "塑形"))) {
      return "Bodybuilding";
    }
    if (containsAny(normalizedText, List.of("mobility", "yoga", "stretch", "flexibility", "flow", "breathing", "热身", "拉伸", "活动"))) {
      return "Mobility / Yoga";
    }
    if (containsAny(normalizedText, List.of("rehab", "rehabilitation", "injury", "pain", "corrective", "恢复", "康复", "稳定"))) {
      return "Rehab";
    }
    if (containsAny(normalizedText, List.of("crossfit", "wod", "amrap", "emom", "for time", "double under", "wall ball"))) {
      return "CrossFit";
    }
    if (containsAny(normalizedText, List.of("conditioning", "cardio", "endurance", "metcon", "interval", "跑步", "燃脂", "有氧"))) {
      return "Strength & Conditioning";
    }
    if (containsAny(normalizedText, List.of("speed", "agility", "power", "explosive", "jump", "athletic", "爆发"))) {
      return "Athletic";
    }
    if (containsAny(normalizedText, List.of("functional", "movement quality", "stability", "control", "core", "单腿", "动作质量"))) {
      return "Functional";
    }
    return "Strength & Conditioning";
  }

  private String inferContentType(String style, String normalizedText) {
    String text = normalizeString(normalizedText).toLowerCase(Locale.ROOT);
    if ("Mobility / Yoga".equals(style)) {
      return containsAny(text, List.of("flow", "follow along", "session")) ? "mobility flow" : "mobility session";
    }
    if ("Rehab".equals(style)) {
      return "rehab session";
    }
    if ("Bodybuilding".equals(style)) {
      return containsAny(text, List.of("push", "pull", "legs", "split")) ? "hypertrophy split" : "hypertrophy session";
    }
    if ("CrossFit".equals(style)) {
      return "metcon session";
    }
    if ("Athletic".equals(style)) {
      return "athletic drill";
    }
    if ("Functional".equals(style)) {
      return "movement quality session";
    }
    return "strength and conditioning session";
  }

  private String inferPlanTypeHint(
    String style,
    String contentType,
    List<String> focusTerms,
    List<String> sentences,
    ContentAnalysisJob job
  ) {
    String requested = job == null ? "" : normalizePlanType(job.getGoalType(), "course");
    if ("module".equals(requested)) {
      return "module";
    }
    if ("Rehab".equals(style) || "Mobility / Yoga".equals(style)) {
      return "module";
    }
    int focusCount = focusTerms == null ? 0 : focusTerms.size();
    int sentenceCount = sentences == null ? 0 : sentences.size();
    if (focusCount <= 3 && sentenceCount <= 4) {
      return "module";
    }
    if (contentType != null && (contentType.contains("drill") || contentType.contains("flow"))) {
      return "module";
    }
    return "course";
  }

  private List<String> extractFocusTerms(String normalizedText) {
    Set<String> terms = new LinkedHashSet<>();
    addDetectedTerm(terms, normalizedText, "ankle stability", List.of("ankle", "dorsiflexion", "脚踝", "足踝"));
    addDetectedTerm(terms, normalizedText, "knee control", List.of("knee", "膝盖", "膝"));
    addDetectedTerm(terms, normalizedText, "hip hinge", List.of("hinge", "hip hinge", "髋铰链", "髋"));
    addDetectedTerm(terms, normalizedText, "core brace", List.of("core", "plank", "brace", "核心"));
    addDetectedTerm(terms, normalizedText, "push pattern", List.of("push", "press", "推", "卧推"));
    addDetectedTerm(terms, normalizedText, "pull pattern", List.of("pull", "row", "pull-up", "pull up", "拉", "划船"));
    addDetectedTerm(terms, normalizedText, "squat pattern", List.of("squat", "deep squat", "深蹲"));
    addDetectedTerm(terms, normalizedText, "mobility", List.of("mobility", "flexibility", "stretch", "flow", "活动", "拉伸"));
    addDetectedTerm(terms, normalizedText, "conditioning", List.of("conditioning", "cardio", "interval", "metcon", "有氧", "燃脂"));
    addDetectedTerm(terms, normalizedText, "power", List.of("power", "explosive", "jump", "sprint", "爆发"));
    addDetectedTerm(terms, normalizedText, "balance", List.of("balance", "stability", "single-leg", "单腿", "平衡"));
    addDetectedTerm(terms, normalizedText, "breathing", List.of("breath", "breathing", "respiration", "呼吸"));
    return List.copyOf(terms);
  }

  private List<String> extractEquipmentHints(String normalizedText) {
    Set<String> terms = new LinkedHashSet<>();
    addDetectedTerm(terms, normalizedText, "bodyweight", List.of("bodyweight", "自重"));
    addDetectedTerm(terms, normalizedText, "dumbbell", List.of("dumbbell", "哑铃"));
    addDetectedTerm(terms, normalizedText, "barbell", List.of("barbell", "杠铃"));
    addDetectedTerm(terms, normalizedText, "kettlebell", List.of("kettlebell", "壶铃"));
    addDetectedTerm(terms, normalizedText, "band", List.of("band", "resistance band", "弹力带"));
    addDetectedTerm(terms, normalizedText, "cable", List.of("cable", "绳索"));
    addDetectedTerm(terms, normalizedText, "machine", List.of("machine", "器械"));
    addDetectedTerm(terms, normalizedText, "rope", List.of("rope", "jump rope", "跳绳"));
    addDetectedTerm(terms, normalizedText, "bench", List.of("bench", "凳"));
    addDetectedTerm(terms, normalizedText, "box", List.of("box", "台"));
    addDetectedTerm(terms, normalizedText, "mat", List.of("mat", "瑜伽垫", "垫子"));
    return List.copyOf(terms);
  }

  private List<String> extractRiskFlags(String normalizedText) {
    Set<String> terms = new LinkedHashSet<>();
    addDetectedTerm(terms, normalizedText, "knee history", List.of("knee", "knees", "膝盖"));
    addDetectedTerm(terms, normalizedText, "ankle history", List.of("ankle", "脚踝"));
    addDetectedTerm(terms, normalizedText, "back history", List.of("back", "low back", "spine", "腰", "背"));
    addDetectedTerm(terms, normalizedText, "shoulder history", List.of("shoulder", "肩"));
    addDetectedTerm(terms, normalizedText, "pain", List.of("pain", "疼"));
    addDetectedTerm(terms, normalizedText, "injury", List.of("injury", "injured", "伤", "受伤"));
    addDetectedTerm(terms, normalizedText, "rehab", List.of("rehab", "recovery", "康复", "恢复"));
    return List.copyOf(terms);
  }

  private void addDetectedTerm(Set<String> target, String source, String label, List<String> keywords) {
    if (target == null || source == null || source.isBlank() || label == null || label.isBlank()) {
      return;
    }
    if (containsAny(source, keywords)) {
      target.add(label);
    }
  }

  private String joinInsightList(Map<String, Object> insight, String key, int limit) {
    List<String> items = readInsightList(insight, key);
    if (items.isEmpty()) {
      return "";
    }
    return String.join(", ", items.subList(0, Math.min(limit, items.size())));
  }

  private List<String> readInsightList(Map<String, Object> insight, String key) {
    if (insight == null || insight.isEmpty() || key == null || key.isBlank()) {
      return List.of();
    }
    Object value = insight.get(key);
    if (value instanceof List<?> list) {
      List<String> items = new ArrayList<>();
      for (Object item : list) {
        String text = item == null ? "" : normalizeString(String.valueOf(item));
        if (!text.isEmpty()) {
          items.add(text);
        }
      }
      return List.copyOf(items);
    }
    String text = normalizeString(value == null ? "" : String.valueOf(value));
    if (text.isBlank()) {
      return List.of();
    }
    return List.of(text);
  }

  private String readInsightString(Map<String, Object> insight, String key) {
    if (insight == null || insight.isEmpty() || key == null || key.isBlank()) {
      return "";
    }
    Object value = insight.get(key);
    return value == null ? "" : normalizeString(String.valueOf(value));
  }

  private String mapText(Object parsed, String... keys) {
    if (!(parsed instanceof Map<?, ?> map) || keys == null) {
      return "";
    }
    for (String key : keys) {
      Object value = map.get(key);
      if (value == null) {
        continue;
      }
      String text = normalizeString(String.valueOf(value));
      if (!text.isEmpty()) {
        return text;
      }
    }
    return "";
  }

  private String firstNonBlank(String... values) {
    if (values == null || values.length == 0) {
      return "";
    }
    for (String value : values) {
      String normalized = normalizeString(value);
      if (!normalized.isEmpty()) {
        return normalized;
      }
    }
    return "";
  }

  private BigDecimal averageConfidence(List<ContentMovementCandidate> candidates) {
    if (candidates == null || candidates.isEmpty()) {
      return BigDecimal.valueOf(0.00).setScale(2, RoundingMode.HALF_UP);
    }
    BigDecimal total = BigDecimal.ZERO;
    int count = 0;
    for (ContentMovementCandidate candidate : candidates) {
      if (candidate == null || candidate.getConfidence() == null) {
        continue;
      }
      total = total.add(candidate.getConfidence());
      count += 1;
    }
    if (count == 0) {
      return BigDecimal.valueOf(0.00).setScale(2, RoundingMode.HALF_UP);
    }
    return total.divide(BigDecimal.valueOf(count), 2, RoundingMode.HALF_UP);
  }

  private List<ExerciseMatch> findTopExerciseMatches(
    String label,
    List<ExerciseLite> activeExercises,
    int limit
  ) {
    if (activeExercises == null || activeExercises.isEmpty() || limit <= 0) {
      return List.of();
    }
    String normalizedLabel = normalizeForMatch(label);
    if (normalizedLabel.isEmpty()) {
      return List.of();
    }

    Set<String> labelTokens = splitMatchTokens(normalizedLabel);
    List<ExerciseMatch> matches = new ArrayList<>();

    for (ExerciseLite exercise : activeExercises) {
      if (exercise == null || normalizeString(exercise.getName()).isEmpty()) {
        continue;
      }
      int scoreValue = scoreExerciseName(normalizedLabel, labelTokens, exercise.getName());
      BigDecimal score = BigDecimal
        .valueOf(Math.max(0, Math.min(100, scoreValue)))
        .setScale(2, RoundingMode.HALF_UP);
      matches.add(new ExerciseMatch(exercise, score));
    }

    matches.sort(
      Comparator
        .comparing((ExerciseMatch item) -> item.score, Comparator.nullsLast(Comparator.reverseOrder()))
        .thenComparing(
          item ->
            item.exercise == null || item.exercise.getId() == null
              ? Long.MAX_VALUE
              : item.exercise.getId()
        )
    );
    if (matches.size() <= limit) {
      return matches;
    }
    return List.copyOf(matches.subList(0, limit));
  }

  private ExerciseMatch findBestExerciseMatch(String label, List<ExerciseLite> activeExercises) {
    List<ExerciseMatch> topMatches = findTopExerciseMatches(label, activeExercises, 1);
    if (topMatches.isEmpty()) {
      return null;
    }
    return topMatches.get(0);
  }

  private int scoreExerciseName(String label, Set<String> labelTokens, String exerciseName) {
    String normalizedName = normalizeForMatch(exerciseName);
    if (normalizedName.isEmpty()) {
      return 0;
    }
    if (normalizedName.equals(label)) {
      return 100;
    }
    if (normalizedName.contains(label) || label.contains(normalizedName)) {
      int lengthGap = Math.abs(normalizedName.length() - label.length());
      return Math.max(86, 96 - Math.min(10, lengthGap));
    }

    Set<String> exerciseTokens = splitMatchTokens(normalizedName);
    if (labelTokens.isEmpty() || exerciseTokens.isEmpty()) {
      return 0;
    }

    int overlap = 0;
    for (String token : labelTokens) {
      if (exerciseTokens.contains(token)) {
        overlap += 1;
      }
    }
    if (overlap <= 0) {
      return 0;
    }

    int union = labelTokens.size() + exerciseTokens.size() - overlap;
    double jaccard = union <= 0 ? 0 : (double) overlap / (double) union;
    double coverage = (double) overlap / (double) labelTokens.size();
    int score = (int) Math.round(35 + 45 * jaccard + 20 * coverage);

    String firstToken = labelTokens.iterator().next();
    if (!firstToken.isBlank() && exerciseTokens.contains(firstToken)) {
      score += 4;
    }
    return Math.max(0, Math.min(100, score));
  }

  private Set<String> splitMatchTokens(String value) {
    if (value == null || value.isBlank()) {
      return Set.of();
    }
    Set<String> tokens = new LinkedHashSet<>();
    for (String token : value.split("\\s+")) {
      String safe = normalizeString(token);
      if (!safe.isEmpty()) {
        tokens.add(safe);
      }
    }
    return tokens;
  }

  private String normalizeForMatch(String value) {
    return normalizeString(value)
      .toLowerCase(Locale.ROOT)
      .replaceAll("[^a-z0-9]+", " ")
      .trim();
  }

  private List<ExerciseLite> listActiveExercises(int limit) {
    return exerciseLiteMapper.selectList(
      new LambdaQueryWrapper<ExerciseLite>()
        .eq(ExerciseLite::getStatus, 1)
        .eq(ExerciseLite::getIsDeleted, 0)
        .orderByAsc(ExerciseLite::getId)
        .last("LIMIT " + limit)
    );
  }

  private ContentJobResponse buildJobResponse(ContentAnalysisJob job) {
    ContentJobResponse response = new ContentJobResponse();
    response.setJobId(job.getId());
    response.setUserId(job.getUserId());
    response.setSourcePlatform(job.getSourcePlatform());
    response.setSourceUrl(job.getSourceUrl());
    response.setSourceVideoId(job.getSourceVideoId());
    response.setAnalysisMode(job.getAnalysisMode());
    response.setGoalType(job.getGoalType());
    response.setPipelineStatus(job.getPipelineStatus());
    response.setErrorCode(job.getErrorCode());
    response.setErrorMessage(job.getErrorMessage());
    response.setConfidenceScore(job.getConfidenceScore());
    response.setResultSummary(job.getResultSummary());
    response.setAnalysisResultJson(job.getAnalysisResultJson());
    response.setRequiredMaterial(
      Set.of("material_required", "visual_review_required").contains(normalizeString(job.getPipelineStatus()).toLowerCase(Locale.ROOT))
        ? sourceRequiredMaterial(countVisualFrameAssets(listActiveAssets(job.getId())))
        : REQUIRED_MATERIAL_HINT
    );
    response.setMaterialCount(countActiveAssets(job.getId()));
    response.setCandidateCount(countActiveCandidates(job.getId()));
    response.setPlanCount(countActivePlans(job.getId()));
    response.setCreateTime(job.getCreateTime());
    response.setUpdateTime(job.getUpdateTime());
    return response;
  }

  private List<String> sourceRequiredMaterial(int visualFrameCount) {
    if (visualFrameCount > 0) {
      List<String> items = new ArrayList<>();
      items.add("visual keyframe movement labeling");
      items.add("caption/audio transcript if available");
      return items;
    }
    return SOURCE_REQUIRED_MATERIAL_HINT;
  }

  private String detectPlatform(String sourceUrl) {
    String value = normalizeString(sourceUrl).toLowerCase(Locale.ROOT);
    if (value.contains("bilibili.com") || value.contains("b23.tv")) {
      return "bilibili";
    }
    if (value.contains("douyin.com")) {
      return "douyin";
    }
    if (value.contains("xiaohongshu.com") || value.contains("xhslink.com")) {
      return "xiaohongshu";
    }
    return "unknown";
  }

  private String extractVideoId(String platform, String sourceUrl) {
    String url = normalizeString(sourceUrl);
    if (url.isEmpty()) {
      return null;
    }
    Pattern pattern = switch (platform) {
      case "bilibili" -> BILIBILI_PATTERN;
      case "douyin" -> DOUYIN_PATTERN;
      case "xiaohongshu" -> XIAOHONGSHU_PATTERN;
      default -> null;
    };
    if (pattern == null) {
      return null;
    }
    Matcher matcher = pattern.matcher(url);
    if (matcher.find()) {
      return matcher.group(1);
    }
    return null;
  }

  private String normalizePlanType(String raw, String fallback) {
    String value = normalizeString(raw).toLowerCase(Locale.ROOT);
    if (!SUPPORTED_PLAN_TYPES.contains(value)) {
      return fallback;
    }
    return value;
  }

  private String normalizeAssetType(String raw) {
    String value = normalizeString(raw).toLowerCase(Locale.ROOT).replace('-', '_');
    if (!SUPPORTED_ASSET_TYPES.contains(value)) {
      throw new IllegalArgumentException("Unsupported asset_type: " + raw);
    }
    return value;
  }

  private String normalizeString(String value) {
    return value == null ? "" : value.trim();
  }

  private String serializeJson(Object value) {
    if (value == null) {
      return null;
    }
    try {
      return objectMapper.writeValueAsString(value);
    } catch (JsonProcessingException ex) {
      return null;
    }
  }

  private Map<Long, ContentExerciseMapping> pickPreferredMapping(List<ContentExerciseMapping> mappings) {
    Map<Long, ContentExerciseMapping> map = new HashMap<>();
    for (ContentExerciseMapping mapping : mappings) {
      Long candidateId = mapping.getCandidateId();
      if (candidateId == null) {
        continue;
      }
      ContentExerciseMapping existing = map.get(candidateId);
      if (existing == null) {
        map.put(candidateId, mapping);
        continue;
      }
      int existingFinal = existing.getFinalSelected() == null ? 0 : existing.getFinalSelected();
      int currentFinal = mapping.getFinalSelected() == null ? 0 : mapping.getFinalSelected();
      if (currentFinal > existingFinal) {
        map.put(candidateId, mapping);
        continue;
      }
      if (currentFinal == existingFinal) {
        BigDecimal existingScore = existing.getMatchScore() == null ? BigDecimal.ZERO : existing.getMatchScore();
        BigDecimal currentScore = mapping.getMatchScore() == null ? BigDecimal.ZERO : mapping.getMatchScore();
        if (currentScore.compareTo(existingScore) > 0) {
          map.put(candidateId, mapping);
        }
      }
    }
    return map;
  }

  private Map<Long, ExerciseLite> loadExercisesById(Set<Long> exerciseIds) {
    Map<Long, ExerciseLite> result = new HashMap<>();
    if (exerciseIds == null || exerciseIds.isEmpty()) {
      return result;
    }
    List<ExerciseLite> exercises = exerciseLiteMapper.selectBatchIds(exerciseIds);
    for (ExerciseLite item : exercises) {
      if (item == null || item.getId() == null) {
        continue;
      }
      result.put(item.getId(), item);
    }
    return result;
  }

  private Long autoProvisionCandidateMapping(ContentAnalysisJob job, ContentMovementCandidate candidate) {
    ExerciseAutoProvisionService.ProvisionResult provisionResult =
      exerciseAutoProvisionService.provisionFromCandidate(job, candidate);
    if (provisionResult.success() && provisionResult.exerciseId() != null && provisionResult.exerciseId() > 0) {
      String note = normalizeString(provisionResult.note());
      if (!note.isEmpty()) {
        String existingNotes = normalizeString(candidate.getNotes());
        candidate.setNotes(existingNotes.isEmpty() ? note : existingNotes + " | " + note);
        candidate.setUpdateTime(LocalDateTime.now());
        candidateMapper.updateById(candidate);
      }
      return provisionResult.exerciseId();
    }

    String reason = normalizeString(provisionResult.note());
    throw new IllegalArgumentException(
      "Could not create a new exercise from this source candidate%s."
        .formatted(reason.isEmpty() ? "" : ": " + reason)
    );
  }

  private void resolveCandidateMapping(Long jobId, Long candidateId, Long mappedExerciseId) {
    if (mappedExerciseId == null) {
      ContentExerciseMapping best = mappingMapper.selectOne(
        new LambdaQueryWrapper<ContentExerciseMapping>()
          .eq(ContentExerciseMapping::getJobId, jobId)
          .eq(ContentExerciseMapping::getCandidateId, candidateId)
          .eq(ContentExerciseMapping::getIsDeleted, 0)
          .orderByDesc(ContentExerciseMapping::getMatchScore)
          .last("LIMIT 1")
      );
      if (best == null) {
        return;
      }
      mappingMapper.update(
        null,
        new LambdaUpdateWrapper<ContentExerciseMapping>()
          .eq(ContentExerciseMapping::getJobId, jobId)
          .eq(ContentExerciseMapping::getCandidateId, candidateId)
          .eq(ContentExerciseMapping::getIsDeleted, 0)
          .set(ContentExerciseMapping::getFinalSelected, 0)
          .set(ContentExerciseMapping::getUpdateTime, LocalDateTime.now())
      );
      best.setFinalSelected(1);
      best.setUpdateTime(LocalDateTime.now());
      mappingMapper.updateById(best);
      return;
    }

    ExerciseLite targetExercise = exerciseLiteMapper.selectOne(
      new LambdaQueryWrapper<ExerciseLite>()
        .eq(ExerciseLite::getId, mappedExerciseId)
        .eq(ExerciseLite::getStatus, 1)
        .eq(ExerciseLite::getIsDeleted, 0)
        .last("LIMIT 1")
    );
    if (targetExercise == null) {
      throw new IllegalArgumentException("mapped_exercise_id does not exist in exercise library.");
    }

    mappingMapper.update(
      null,
      new LambdaUpdateWrapper<ContentExerciseMapping>()
        .eq(ContentExerciseMapping::getJobId, jobId)
        .eq(ContentExerciseMapping::getCandidateId, candidateId)
        .eq(ContentExerciseMapping::getIsDeleted, 0)
        .set(ContentExerciseMapping::getFinalSelected, 0)
        .set(ContentExerciseMapping::getUpdateTime, LocalDateTime.now())
    );

    ContentExerciseMapping targetMapping = mappingMapper.selectOne(
      new LambdaQueryWrapper<ContentExerciseMapping>()
        .eq(ContentExerciseMapping::getJobId, jobId)
        .eq(ContentExerciseMapping::getCandidateId, candidateId)
        .eq(ContentExerciseMapping::getExerciseId, mappedExerciseId)
        .eq(ContentExerciseMapping::getIsDeleted, 0)
        .last("LIMIT 1")
    );

    if (targetMapping == null) {
      targetMapping = new ContentExerciseMapping();
      targetMapping.setJobId(jobId);
      targetMapping.setCandidateId(candidateId);
      targetMapping.setExerciseId(mappedExerciseId);
      targetMapping.setMatchScore(BigDecimal.valueOf(95.00));
      targetMapping.setMappingSource("manual");
      targetMapping.setFinalSelected(1);
      targetMapping.setStatus(1);
      targetMapping.setIsDeleted(0);
      targetMapping.setCreateTime(LocalDateTime.now());
      targetMapping.setUpdateTime(LocalDateTime.now());
      mappingMapper.insert(targetMapping);
      return;
    }

    targetMapping.setFinalSelected(1);
    targetMapping.setMappingSource("manual");
    if (targetMapping.getMatchScore() == null || targetMapping.getMatchScore().compareTo(BigDecimal.valueOf(90)) < 0) {
      targetMapping.setMatchScore(BigDecimal.valueOf(95.00));
    }
    targetMapping.setUpdateTime(LocalDateTime.now());
    mappingMapper.updateById(targetMapping);
  }

  private List<ExerciseAssignment> ensureDiverseExercisePool(
    ContentAnalysisJob job,
    String planType,
    String style,
    List<ExerciseAssignment> baseAssignments,
    boolean sourceReconstruction
  ) {
    List<ExerciseAssignment> pool = sourceReconstruction
      ? keepOrderedAssignments(baseAssignments)
      : dedupeAssignmentsByExerciseId(baseAssignments);
    int minUnique = sourceReconstruction ? 1 : "module".equals(planType) ? 3 : 4;
    int preferredUnique = sourceReconstruction ? Math.max(1, pool.size()) : "module".equals(planType) ? 4 : 6;
    if (pool.size() >= preferredUnique) {
      return pool;
    }

    if (sourceReconstruction) {
      if (pool.size() < minUnique) {
        throw new IllegalArgumentException(
          "No source exercise mapping available. Please review the parsed video candidates first."
        );
      }
      return pool;
    }

    List<ExerciseLite> activeExercises = listActiveExercises(320);
    Set<Long> usedIds = new LinkedHashSet<>();
    for (ExerciseAssignment item : pool) {
      if (item != null && item.exerciseId != null && item.exerciseId > 0) {
        usedIds.add(item.exerciseId);
      }
    }

    List<GeneratedCandidateSeed> seeds = styleFallbackSeeds(style, planType);
    for (GeneratedCandidateSeed seed : seeds) {
      if (pool.size() >= preferredUnique) {
        break;
      }
      String label = normalizeString(seed == null ? null : seed.label);
      if (label.isEmpty() || hasSimilarAssignmentName(pool, label)) {
        continue;
      }
      ExerciseMatch best = findBestExerciseMatch(label, activeExercises);
      if (
        best != null &&
        best.exercise != null &&
        best.exercise.getId() != null &&
        !usedIds.contains(best.exercise.getId()) &&
        best.score != null &&
        best.score.compareTo(RULE_MATCH_ACCEPT_MIN_SCORE) >= 0
      ) {
        pool.add(new ExerciseAssignment(best.exercise.getId(), best.exercise.getName()));
        usedIds.add(best.exercise.getId());
        continue;
      }

      ExerciseAutoProvisionService.ProvisionResult provisionResult =
        exerciseAutoProvisionService.provisionFromLabel(job, label, "plan_gap_fill");
      if (provisionResult.success() && provisionResult.exerciseId() != null) {
        ExerciseLite created = exerciseLiteMapper.selectById(provisionResult.exerciseId());
        if (created != null && created.getId() != null && !usedIds.contains(created.getId())) {
          pool.add(new ExerciseAssignment(created.getId(), created.getName()));
          usedIds.add(created.getId());
        }
      }
    }

    if (pool.size() < preferredUnique) {
      // Do not fill from the first active catalog rows. That creates false plans such as
      // repeated 90/90 Hamstring or 3/4 Sit-Up when the real movement is simply unmapped.
      // If style seeds cannot be matched/provisioned, fail loudly instead of fabricating a plan.
    }

    if (pool.size() < minUnique) {
      throw new IllegalArgumentException(
        "Insufficient unique exercises after auto-fill. Please review candidate mapping or source content."
      );
    }
    return pool;
  }

  private List<ExerciseAssignment> dedupeAssignmentsByExerciseId(List<ExerciseAssignment> assignments) {
    if (assignments == null || assignments.isEmpty()) {
      return new ArrayList<>();
    }
    Set<Long> seen = new LinkedHashSet<>();
    List<ExerciseAssignment> result = new ArrayList<>();
    for (ExerciseAssignment item : assignments) {
      if (item == null || item.exerciseId == null || item.exerciseId <= 0) {
        continue;
      }
      if (!seen.add(item.exerciseId)) {
        continue;
      }
      result.add(item);
    }
    return result;
  }

  private List<ExerciseAssignment> keepOrderedAssignments(List<ExerciseAssignment> assignments) {
    if (assignments == null || assignments.isEmpty()) {
      return new ArrayList<>();
    }
    List<ExerciseAssignment> result = new ArrayList<>();
    for (ExerciseAssignment item : assignments) {
      if (item == null || item.exerciseId == null || item.exerciseId <= 0) {
        continue;
      }
      String name = normalizeString(item.exerciseName);
      if (name.isEmpty()) {
        continue;
      }
      result.add(new ExerciseAssignment(item.exerciseId, name, item.startSec, item.endSec, item.sourceNotes));
    }
    return result;
  }

  private boolean hasSimilarAssignmentName(List<ExerciseAssignment> assignments, String name) {
    String target = normalizeForMatch(name);
    if (target.isEmpty()) {
      return false;
    }
    for (ExerciseAssignment item : assignments) {
      String current = normalizeForMatch(item == null ? null : item.exerciseName);
      if (current.isEmpty()) {
        continue;
      }
      if (current.equals(target) || current.contains(target) || target.contains(current)) {
        return true;
      }
    }
    return false;
  }

  private List<Map<String, Object>> tryGeneratePlanStructuresByAi(
    ContentAnalysisJob job,
    ContentPlanGenerateRequest request,
    String planType,
    String style,
    int optionCount,
    List<String> blocks,
    List<ExerciseAssignment> exercisePool,
    boolean sourceReconstruction
  ) {
    if (chatClient == null || optionCount <= 0 || exercisePool == null || exercisePool.isEmpty()) {
      return List.of();
    }

    String systemPrompt = buildPlanGeneratorSystemPrompt(planType, style, optionCount, blocks, sourceReconstruction);
    String userPrompt = buildPlanGeneratorUserPrompt(job, request, planType, style, optionCount, blocks, exercisePool, sourceReconstruction);

    try {
      String raw = chatClient
        .prompt()
        .system(systemPrompt)
        .user(userPrompt)
        .call()
        .content();
      List<Map<String, Object>> parsed = parsePlanStructuresFromAiContent(raw);
      if (parsed.isEmpty()) {
        return List.of();
      }

      List<Map<String, Object>> normalized = new ArrayList<>();
      for (int i = 0; i < parsed.size() && normalized.size() < optionCount; i += 1) {
        Map<String, Object> structure = normalizePlanStructure(
          job,
          parsed.get(i),
          planType,
          style,
          i + 1,
          blocks,
          exercisePool,
          sourceReconstruction
        );
        if (sourceReconstruction || !isLowQualityPlanStructure(structure, planType)) {
          normalized.add(structure);
        }
      }
      return normalized;
    } catch (Exception ex) {
      return List.of();
    }
  }

  private String buildPlanGeneratorSystemPrompt(
    String planType,
    String style,
    int optionCount,
    List<String> blocks,
    boolean sourceReconstruction
  ) {
    String blockLine = blocks == null || blocks.isEmpty() ? "" : String.join(" -> ", blocks);
    int minUnique = sourceReconstruction ? 1 : "module".equals(planType) ? 3 : 4;
    String blockRules = sourceReconstruction
      ? """
- Source phase rule: infer block names from the analyzed video only when the source clearly indicates phases; otherwise use this single container: %s.
- Do not force a generic style template. The plan structure must mirror the source, not become a new coach-generated alternative.
""".formatted(blockLine)
      : """
- Required block flow (keep complete, do not omit): %s
- Each required block must appear exactly once in that order and contain at least one exercise row.
- If the user explicitly requested stages such as Warmup/Main Training/Cooldown, keep exactly that stage flow and do not replace it with a generic circuit.
""".formatted(blockLine);
    String modeRules = sourceReconstruction
      ? """
- SOURCE RECONSTRUCTION MODE: generate exactly one plan that represents the analyzed video's actual training content.
- Do not create A/B/C alternatives, do not invent a different training idea, and do not add style filler movements unless the source is missing all mapped exercises.
- Preserve the source exercise order as much as possible; organize into blocks only when the video/text indicates phases.
- It is acceptable for this source plan to have fewer unique exercises if the video itself repeats movements.
"""
      : """
- Options must be materially different, not the same session with renamed titles:
  Option 1/A = technique-strength emphasis, longer rest, primary movement quality.
  Option 2/B = volume-control emphasis, moderate rest, higher reps or supersets.
  Option 3/C = power-density emphasis, explosive intent, shorter rest or interval/circuit density.
""";
    String qualityRules = sourceReconstruction
      ? """
- Use the source movement sequence as the plan backbone, even if it has fewer unique exercises or repeated movements.
- Never add unrelated filler just to increase diversity.
- If the source provides sets/reps/time/rest, preserve those details; otherwise choose conservative executable defaults.
"""
      : """
- Keep plans practical and diverse: at least %d unique exercises per option.
- Avoid collapse: one exercise must not dominate > 35%% of all rows in an option.
""".formatted(minUnique);
    return """
You are a professional strength-and-conditioning coach planner.
Return ONLY valid JSON. Do not output markdown or extra text.

Output schema (strict):
{
  "options": [
    {
      "title": "string",
      "summary": "string",
      "duration_min": number,
      "progression": "string",
      "blocks": [
        {
          "block_name": "string",
          "goal": "string",
          "groups": [
            {
              "group_type": "straight_sets|superset|circuit|flow|interval",
              "rounds": number,
              "rest_seconds": number,
              "exercises": [
                {
                  "exercise_id": number,
                  "exercise_name": "string",
                  "sets": number,
                  "reps": number,
                  "rest_seconds": number,
                  "time_seconds": number,
                  "rnd": number
                }
              ]
            }
          ]
        }
      ]
    }
  ]
}

Rules:
- Generate exactly %d options.
- This is a SINGLE-SESSION %s plan, style: %s.
%s
%s
- Use only provided exercise IDs from catalog whenever possible.
- If a suitable catalog exercise does not exist, set exercise_id=0 and provide a concrete exercise_name.
- Never use an unrelated catalog id just because a requested exercise is missing.
%s
- Parameter bounds: sets 1-6, reps 0-20, rest_seconds 15-180, time_seconds 0-300, rnd 1-8.
- Keep scientific sequencing by block purpose.
""".formatted(optionCount, planType, style, blockRules.trim(), modeRules.trim(), qualityRules.trim()).trim();
  }

  private String buildPlanGeneratorUserPrompt(
    ContentAnalysisJob job,
    ContentPlanGenerateRequest request,
    String planType,
    String style,
    int optionCount,
    List<String> blocks,
    List<ExerciseAssignment> exercisePool,
    boolean sourceReconstruction
  ) {
    StringBuilder catalog = new StringBuilder();
    int sequenceIndex = 1;
    for (ExerciseAssignment item : exercisePool) {
      if (item == null || item.exerciseId == null || item.exerciseId <= 0) {
        continue;
      }
      catalog
        .append(sourceReconstruction ? "- source_order: " : "- ")
        .append(sourceReconstruction ? sequenceIndex + ", " : "")
        .append("id: ")
        .append(item.exerciseId)
        .append(", name: ")
        .append(normalizeString(item.exerciseName))
        .append('\n');
      sequenceIndex += 1;
    }

    String userPrompt = normalizeString(request == null ? null : request.getUserPrompt());
    String requestPayload = normalizeString(job == null ? null : job.getRequestPayload());
    String analysisSummary = normalizeString(job == null ? null : job.getResultSummary());
    String sourceUrl = normalizeString(job == null ? null : job.getSourceUrl());
    String blockFlow = blocks == null ? "" : String.join(" -> ", blocks);
    String taskMode = sourceReconstruction
      ? """
- mode: source_reconstruction
- Build one plan from the source video/text itself.
- Treat the source exercise sequence below as ordered and potentially repetitive; do not expand into alternative plans.
- If the source has a clear sequence, keep that sequence.
- If the source has no explicit warmup/main/cooldown labels, keep a single source sequence block rather than inventing missing phases.
"""
      : """
- Differentiate A/B/C clearly:
  A technique-strength, B volume-control, C power-density.
""";
    String catalogLabel = sourceReconstruction
      ? "Source exercise sequence (ordered id + name; preserve order, repeats are meaningful):"
      : "Allowed exercise catalog (id + name):";

    return """
Task:
- Generate exactly %d single-session options.
- plan_type: %s
- style: %s
- block guidance: %s
- If a requested movement is not in the catalog, output exercise_id=0 with the real exercise_name; do not substitute an unrelated id.
%s

User intent text:
%s

Job request payload:
%s

Analysis summary:
%s

Source:
%s

%s
%s
""".formatted(
      optionCount,
      planType,
      style,
      blockFlow,
      taskMode.trim(),
      userPrompt,
      requestPayload,
      analysisSummary,
      sourceUrl,
      catalogLabel,
      catalog.toString().trim()
    ).trim();
  }

  private List<Map<String, Object>> parsePlanStructuresFromAiContent(String content) {
    String safe = normalizeString(content);
    if (safe.isEmpty()) {
      return List.of();
    }
    String json = extractFirstJsonContainer(safe);
    if (json.isEmpty()) {
      return List.of();
    }

    try {
      Object parsed = objectMapper.readValue(json, Object.class);
      List<Map<String, Object>> structures = new ArrayList<>();
      if (parsed instanceof Map<?, ?> root) {
        Object optionsObj = root.get("options");
        List<Map<String, Object>> options = toObjectMapList(optionsObj);
        for (Map<String, Object> option : options) {
          Map<String, Object> structure = toObjectMap(option.get("structure"));
          if (structure.isEmpty()) {
            structure = option;
          }
          if (!structure.isEmpty()) {
            structures.add(structure);
          }
        }
        return structures;
      }
      if (parsed instanceof List<?>) {
        return toObjectMapList(parsed);
      }
    } catch (Exception ignored) {
      return List.of();
    }
    return List.of();
  }

  private String extractFirstJsonContainer(String raw) {
    if (raw == null || raw.isBlank()) {
      return "";
    }
    int objStart = raw.indexOf('{');
    int objEnd = raw.lastIndexOf('}');
    int arrStart = raw.indexOf('[');
    int arrEnd = raw.lastIndexOf(']');

    if (objStart >= 0 && objEnd > objStart) {
      return raw.substring(objStart, objEnd + 1);
    }
    if (arrStart >= 0 && arrEnd > arrStart) {
      return raw.substring(arrStart, arrEnd + 1);
    }
    return "";
  }

  private Map<String, Object> normalizePlanStructure(
    ContentAnalysisJob job,
    Map<String, Object> raw,
    String planType,
    String style,
    int optionIndex,
    List<String> expectedBlocks,
    List<ExerciseAssignment> exercisePool,
    boolean sourceReconstruction
  ) {
    if (raw == null || raw.isEmpty()) {
      return buildPlanStructure(job, planType, style, optionIndex, expectedBlocks, exercisePool, sourceReconstruction);
    }

    Map<Long, ExerciseAssignment> poolById = new LinkedHashMap<>();
    for (ExerciseAssignment item : exercisePool) {
      if (item == null || item.exerciseId == null || item.exerciseId <= 0) {
        continue;
      }
      poolById.put(item.exerciseId, item);
    }
    List<ExerciseLite> activeExercises = listActiveExercises(320);
    Map<String, ExerciseAssignment> provisionCache = new HashMap<>();

    List<Map<String, Object>> rawBlocks = toObjectMapList(raw.get("blocks"));
    if (rawBlocks.isEmpty()) {
      rawBlocks = toObjectMapList(raw.get("phases"));
    }
    if (rawBlocks.isEmpty()) {
      return buildPlanStructure(job, planType, style, optionIndex, expectedBlocks, exercisePool, sourceReconstruction);
    }

    List<Map<String, Object>> normalizedBlocks = new ArrayList<>();
    for (int blockIndex = 0; blockIndex < rawBlocks.size(); blockIndex += 1) {
      Map<String, Object> block = rawBlocks.get(blockIndex);
      String blockName = firstNonBlank(
        mapText(block, "block_name", "blockName", "title", "name"),
        blockIndex < expectedBlocks.size() ? expectedBlocks.get(blockIndex) : "",
        "Block " + (blockIndex + 1)
      );
      String blockGoal = firstNonBlank(mapText(block, "goal", "purpose"), blockGoal(blockName, style));

      List<Map<String, Object>> rawGroups = toObjectMapList(block.get("groups"));
      if (rawGroups.isEmpty()) {
        Map<String, Object> synthetic = new LinkedHashMap<>();
        synthetic.put("group_type", groupTypeFor(blockName));
        synthetic.put("rounds", roundsFor(blockName, planType, optionIndex));
        synthetic.put("rest_seconds", restForGroup(groupTypeFor(blockName), blockName));
        Object direct = block.containsKey("exercises") ? block.get("exercises") : block.get("items");
        synthetic.put("exercises", direct);
        rawGroups = List.of(synthetic);
      }

      List<Map<String, Object>> normalizedGroups = new ArrayList<>();
      for (Map<String, Object> group : rawGroups) {
        String groupType = firstNonBlank(
          mapText(group, "group_type", "groupType", "method", "group_hint"),
          groupTypeFor(blockName)
        ).toLowerCase(Locale.ROOT).replace('-', '_').replace(' ', '_');
        if (groupType.isBlank()) {
          groupType = "straight_sets";
        }
        int rounds = clampInt(
          readIntFromMap(group, roundsFor(blockName, planType, optionIndex), "rounds", "rnd"),
          1,
          8
        );
        int groupRest = clampInt(
          readIntFromMap(group, restForGroup(groupType, blockName), "rest_seconds", "restSeconds", "rest"),
          15,
          240
        );

        List<Map<String, Object>> rawExercises = toObjectMapList(group.get("exercises"));
        if (rawExercises.isEmpty()) {
          rawExercises = toObjectMapList(group.get("items"));
        }
        List<Map<String, Object>> normalizedExercises = new ArrayList<>();
        for (int i = 0; i < rawExercises.size(); i += 1) {
          Map<String, Object> exercise = rawExercises.get(i);
          ExerciseAssignment assignment = resolveAssignmentFromPlanNode(
            job,
            exercise,
            exercisePool,
            poolById,
            activeExercises,
            provisionCache
          );
          if (assignment == null || assignment.exerciseId == null || assignment.exerciseId <= 0) {
            continue;
          }

          int defaultSets = defaultSetsForBlock(blockName);
          int defaultReps = defaultRepsForBlock(blockName, i);
          int defaultTime = defaultTimeForBlock(blockName, i);

          Map<String, Object> row = new LinkedHashMap<>();
          row.put("exercise_id", assignment.exerciseId);
          row.put("exercise_name", assignment.exerciseName);
          row.put("sets", clampInt(readIntFromMap(exercise, defaultSets, "sets"), 1, 6));
          row.put("reps", clampInt(readIntFromMap(exercise, defaultReps, "reps"), 0, 25));
          row.put(
            "rest_seconds",
            clampInt(
              readIntFromMap(exercise, groupRest, "rest_seconds", "restSeconds", "rest"),
              15,
              240
            )
          );
          row.put(
            "time_seconds",
            clampInt(
              readIntFromMap(exercise, defaultTime, "time_seconds", "timeSeconds", "duration_seconds"),
              0,
              360
            )
          );
          row.put("tempo", firstNonBlank(mapText(exercise, "tempo"), "controlled"));
          row.put("rnd", clampInt(readIntFromMap(exercise, rounds, "rnd", "rounds"), 1, 8));
          row.put("group_hint", groupType);
          normalizedExercises.add(row);
        }

        if (normalizedExercises.isEmpty()) {
          continue;
        }
        Map<String, Object> groupNode = new LinkedHashMap<>();
        groupNode.put("group_type", groupType);
        groupNode.put("rounds", rounds);
        groupNode.put("rest_seconds", groupRest);
        groupNode.put("exercises", normalizedExercises);
        normalizedGroups.add(groupNode);
      }

      if (normalizedGroups.isEmpty()) {
        continue;
      }

      Map<String, Object> blockNode = new LinkedHashMap<>();
      blockNode.put("block_name", blockName);
      blockNode.put("goal", blockGoal);
      blockNode.put("groups", normalizedGroups);
      normalizedBlocks.add(blockNode);
    }

    if (normalizedBlocks.isEmpty()) {
      return buildPlanStructure(job, planType, style, optionIndex, expectedBlocks, exercisePool, sourceReconstruction);
    }
    if (sourceReconstruction && expectedBlocks != null && expectedBlocks.size() > 1) {
      Set<String> normalizedBlockKeys = normalizedBlocks.stream()
        .map(block -> courseBlockKey(mapText(block, "block_name", "title", "name")))
        .filter(text -> !text.isEmpty())
        .collect(Collectors.toCollection(LinkedHashSet::new));
      long coveredBlocks = expectedBlocks.stream()
        .map(this::courseBlockKey)
        .filter(normalizedBlockKeys::contains)
        .count();
      if (coveredBlocks < Math.min(expectedBlocks.size(), 2)) {
        return buildPlanStructure(job, planType, style, optionIndex, expectedBlocks, exercisePool, true);
      }
    }
    if (sourceReconstruction && !hasEnoughSourcePlanCoverage(normalizedBlocks, exercisePool)) {
      return buildPlanStructure(job, planType, style, optionIndex, expectedBlocks, exercisePool, true);
    }

    Map<String, Object> fallback = buildPlanStructure(job, planType, style, optionIndex, expectedBlocks, exercisePool, sourceReconstruction);
    List<Map<String, Object>> fallbackBlocks = toObjectMapList(fallback.get("blocks"));
    if (!sourceReconstruction) {
      normalizedBlocks = reorderAndCompletePlanBlocks(
        normalizedBlocks,
        fallbackBlocks,
        expectedBlocks,
        planType
      );
      normalizedBlocks = applyPlanVariantToBlocks(normalizedBlocks, planType, optionIndex);
    }

    Map<String, Object> normalized = new LinkedHashMap<>();
    normalized.put("plan_type", planType);
    normalized.put("session_scope", "single_session");
    normalized.put("style", style);
    normalized.put(
      "title",
      sourceReconstruction
        ? firstNonBlank(mapText(raw, "title", "plan_title"), buildSourcePlanTitle(planType, optionIndex))
        : appendVariantLabelToTitle(
            firstNonBlank(mapText(raw, "title", "plan_title"), buildPlanTitle(style, planType, optionIndex)),
            optionIndex
          )
    );
    int defaultDuration = "module".equals(planType) ? 30 : 65;
    int duration = clampInt(readIntFromMap(raw, defaultDuration, "duration_min", "durationMin"), 15, 120);
    normalized.put("duration_min", duration);
    normalized.put(
      "progression",
      firstNonBlank(
        mapText(raw, "progression", "summary"),
        sourceReconstruction ? buildSourcePlanProgression(planType) : buildProgression(planType, style, optionIndex)
      )
    );
    normalized.put("safety_notes", buildSafetyNotes(job));
    normalized.put("blocks", normalizedBlocks);

    if (!sourceReconstruction && isLowQualityPlanStructure(normalized, planType)) {
      return buildPlanStructure(job, planType, style, optionIndex, expectedBlocks, exercisePool, sourceReconstruction);
    }
    return normalized;
  }

  private boolean hasEnoughSourcePlanCoverage(
    List<Map<String, Object>> normalizedBlocks,
    List<ExerciseAssignment> sourcePool
  ) {
    if (sourcePool == null || sourcePool.isEmpty()) {
      return false;
    }
    int expectedRows = 0;
    Set<Long> sourceIds = new LinkedHashSet<>();
    for (ExerciseAssignment assignment : sourcePool) {
      if (assignment == null || assignment.exerciseId == null || assignment.exerciseId <= 0) {
        continue;
      }
      expectedRows += 1;
      sourceIds.add(assignment.exerciseId);
    }
    expectedRows = Math.min(expectedRows, 80);
    if (expectedRows <= 0 || sourceIds.isEmpty()) {
      return false;
    }

    int rowCount = 0;
    int matchingRows = 0;
    for (Map<String, Object> block : normalizedBlocks) {
      for (Map<String, Object> group : toObjectMapList(block.get("groups"))) {
        for (Map<String, Object> exercise : toObjectMapList(group.get("exercises"))) {
          Long exerciseId = readLongFromMap(exercise, "exercise_id", "exerciseId", "id");
          if (exerciseId == null || exerciseId <= 0) {
            continue;
          }
          rowCount += 1;
          if (sourceIds.contains(exerciseId)) {
            matchingRows += 1;
          }
        }
      }
    }

    int requiredRows = expectedRows <= 3
      ? expectedRows
      : Math.max(3, (int) Math.ceil(expectedRows * 0.7d));
    return rowCount >= requiredRows && matchingRows >= requiredRows;
  }

  private String planStructureExerciseSignature(Map<String, Object> structure) {
    List<Map<String, Object>> blocks = toObjectMapList(structure == null ? null : structure.get("blocks"));
    if (blocks.isEmpty()) {
      return "";
    }
    List<String> parts = new ArrayList<>();
    for (Map<String, Object> block : blocks) {
      parts.add(courseBlockKey(mapText(block, "block_name", "title", "name")));
      for (Map<String, Object> group : toObjectMapList(block.get("groups"))) {
        for (Map<String, Object> exercise : toObjectMapList(group.get("exercises"))) {
          String name = firstNonBlank(
            mapText(exercise, "exercise_name", "exerciseName", "name"),
            String.valueOf(readLongFromMap(exercise, "exercise_id", "exerciseId", "id"))
          );
          parts.add(normalizeForMatch(name));
        }
      }
    }
    return String.join("|", parts).trim();
  }

  private List<Map<String, Object>> applyPlanVariantToBlocks(
    List<Map<String, Object>> blocks,
    String planType,
    int optionIndex
  ) {
    if (blocks == null || blocks.isEmpty()) {
      return blocks;
    }
    String variant = planVariantKey(optionIndex);
    for (Map<String, Object> block : blocks) {
      String blockName = mapText(block, "block_name", "title", "name");
      String blockKey = courseBlockKey(blockName);
      List<Map<String, Object>> groups = toObjectMapList(block.get("groups"));
      for (Map<String, Object> group : groups) {
        String baseGroupType = firstNonBlank(
          mapText(group, "group_type", "groupType", "method"),
          groupTypeFor(blockName)
        ).toLowerCase(Locale.ROOT).replace('-', '_').replace(' ', '_');
        String groupType = variantGroupTypeFor(blockKey, baseGroupType, variant);
        int groupRounds = variantRoundsFor(blockKey, planType, optionIndex, readIntFromMap(group, 1, "rounds", "rnd"));
        int groupRest = variantRestForGroup(blockKey, groupType, variant, readIntFromMap(group, 60, "rest_seconds", "restSeconds", "rest"));
        group.put("group_type", groupType);
        group.put("rounds", groupRounds);
        group.put("rest_seconds", groupRest);

        for (Map<String, Object> exercise : toObjectMapList(group.get("exercises"))) {
          applyPlanVariantToExercise(exercise, blockKey, groupType, variant, groupRounds);
        }
      }
      block.put("groups", groups);
    }
    return blocks;
  }

  private String variantGroupTypeFor(String blockKey, String baseGroupType, String variant) {
    if (List.of("warmup", "activation", "movementprep").contains(blockKey)) {
      return "circuit";
    }
    if (List.of("breathing", "mobility", "flow", "stretch", "relax", "cooldown").contains(blockKey)) {
      return "flow";
    }
    if ("volume_control".equals(variant) && List.of("secondary", "accessory", "isolation", "pump").contains(blockKey)) {
      return "superset";
    }
    if ("power_density".equals(variant) && List.of("conditioning", "finisher", "wod", "circuit").contains(blockKey)) {
      return "interval";
    }
    if (List.of("conditioning", "finisher", "wod", "circuit").contains(blockKey)) {
      return "circuit";
    }
    return firstNonBlank(baseGroupType, "straight_sets");
  }

  private int variantRoundsFor(String blockKey, String planType, int optionIndex, int fallback) {
    String variant = planVariantKey(optionIndex);
    if (List.of("conditioning", "finisher", "wod", "circuit").contains(blockKey)) {
      if ("technique_strength".equals(variant)) return 2;
      if ("volume_control".equals(variant)) return 3;
      return 4;
    }
    if ("module".equals(planType)) {
      if ("power_density".equals(variant)) return Math.max(3, fallback);
      return Math.max(2, fallback);
    }
    return Math.max(1, fallback);
  }

  private int variantRestForGroup(String blockKey, String groupType, String variant, int fallback) {
    if ("flow".equals(groupType)) return 20;
    if ("interval".equals(groupType)) return 30;
    if ("superset".equals(groupType)) return "volume_control".equals(variant) ? 45 : 60;
    if (List.of("speed", "agility", "power").contains(blockKey)) return "technique_strength".equals(variant) ? 120 : 90;
    if (List.of("strength", "compound", "main").contains(blockKey)) {
      if ("volume_control".equals(variant)) return 75;
      if ("power_density".equals(variant)) return 90;
      return 120;
    }
    if (List.of("conditioning", "finisher", "wod", "circuit").contains(blockKey)) {
      if ("technique_strength".equals(variant)) return 60;
      if ("volume_control".equals(variant)) return 45;
      return 30;
    }
    return clampInt(fallback, 15, 240);
  }

  private void applyPlanVariantToExercise(
    Map<String, Object> exercise,
    String blockKey,
    String groupType,
    String variant,
    int groupRounds
  ) {
    int sets = readIntFromMap(exercise, 3, "sets");
    int reps = readIntFromMap(exercise, 8, "reps");
    int restSeconds = readIntFromMap(exercise, 60, "rest_seconds", "restSeconds", "rest");
    int timeSeconds = readIntFromMap(exercise, 0, "time_seconds", "timeSeconds", "duration_seconds");
    int rounds = readIntFromMap(exercise, groupRounds, "rnd", "rounds");

    if (List.of("warmup", "activation", "movementprep", "assessment").contains(blockKey)) {
      sets = 2;
      reps = "volume_control".equals(variant) ? 12 : 8;
      restSeconds = 30;
      timeSeconds = "power_density".equals(variant) ? 20 : Math.max(0, Math.min(timeSeconds, 60));
      rounds = 1;
    } else if (List.of("speed", "agility", "power", "skill").contains(blockKey)) {
      sets = "power_density".equals(variant) ? 5 : 4;
      reps = "volume_control".equals(variant) ? 6 : 3;
      restSeconds = "technique_strength".equals(variant) ? 120 : 90;
      timeSeconds = 0;
      rounds = 1;
    } else if (List.of("strength", "compound", "main").contains(blockKey)) {
      if ("volume_control".equals(variant)) {
        sets = 4;
        reps = 10;
        restSeconds = 75;
      } else if ("power_density".equals(variant)) {
        sets = 3;
        reps = 5;
        restSeconds = 90;
      } else {
        sets = 4;
        reps = 5;
        restSeconds = 120;
      }
      timeSeconds = 0;
      rounds = 1;
    } else if (List.of("secondary", "accessory", "isolation", "pump").contains(blockKey)) {
      if ("volume_control".equals(variant)) {
        sets = 3;
        reps = 12;
        restSeconds = 45;
      } else if ("power_density".equals(variant)) {
        sets = 2;
        reps = 8;
        restSeconds = 45;
      } else {
        sets = 3;
        reps = 8;
        restSeconds = 75;
      }
      timeSeconds = 0;
      rounds = 1;
    } else if (List.of("conditioning", "finisher", "wod", "circuit").contains(blockKey)) {
      sets = 1;
      reps = 0;
      restSeconds = variantRestForGroup(blockKey, groupType, variant, restSeconds);
      timeSeconds = "power_density".equals(variant) ? 30 : "volume_control".equals(variant) ? 40 : 30;
      rounds = groupRounds;
    } else if (List.of("breathing", "mobility", "flow").contains(blockKey)) {
      sets = 2;
      reps = "volume_control".equals(variant) ? 8 : 6;
      restSeconds = 20;
      timeSeconds = 30;
      rounds = 1;
    } else if (List.of("stretch", "relax", "cooldown").contains(blockKey)) {
      sets = 1;
      reps = 0;
      restSeconds = 20;
      timeSeconds = "power_density".equals(variant) ? 60 : 50;
      rounds = 1;
    }

    exercise.put("sets", clampInt(sets, 1, 6));
    exercise.put("reps", clampInt(reps, 0, 25));
    exercise.put("rest_seconds", clampInt(restSeconds, 15, 240));
    exercise.put("time_seconds", clampInt(timeSeconds, 0, 360));
    exercise.put("rnd", clampInt(rounds, 1, 8));
    exercise.put("group_hint", groupType);
  }

  private List<Map<String, Object>> reorderAndCompletePlanBlocks(
    List<Map<String, Object>> normalizedBlocks,
    List<Map<String, Object>> fallbackBlocks,
    List<String> expectedBlocks,
    String planType
  ) {
    if (expectedBlocks == null || expectedBlocks.isEmpty()) {
      return normalizedBlocks;
    }

    boolean explicitStageFlow = expectedBlocks.stream()
      .anyMatch((item) -> "main".equals(courseBlockKey(item)));
    boolean[] used = new boolean[normalizedBlocks.size()];
    List<Map<String, Object>> repaired = new ArrayList<>();

    for (String expected : expectedBlocks) {
      List<Map<String, Object>> matches = new ArrayList<>();
      for (int i = 0; i < normalizedBlocks.size(); i += 1) {
        if (used[i]) {
          continue;
        }
        Map<String, Object> block = normalizedBlocks.get(i);
        String blockName = mapText(block, "block_name", "title", "name");
        if (planBlockMatchesExpected(blockName, expected, explicitStageFlow)) {
          used[i] = true;
          matches.add(block);
        }
      }

      if (!matches.isEmpty()) {
        repaired.add(mergePlanBlocks(expected, matches));
        continue;
      }

      Map<String, Object> fallback = findMatchingFallbackBlock(fallbackBlocks, expected, explicitStageFlow);
      if (fallback != null && !fallback.isEmpty()) {
        repaired.add(fallback);
      }
    }

    if (!explicitStageFlow) {
      for (int i = 0; i < normalizedBlocks.size(); i += 1) {
        if (!used[i]) {
          repaired.add(normalizedBlocks.get(i));
        }
      }
    }

    List<Map<String, Object>> nonEmpty = new ArrayList<>();
    for (Map<String, Object> block : repaired) {
      if (!toObjectMapList(block.get("groups")).isEmpty()) {
        nonEmpty.add(block);
      }
    }
    return nonEmpty.isEmpty() ? normalizedBlocks : nonEmpty;
  }

  private Map<String, Object> mergePlanBlocks(String expectedName, List<Map<String, Object>> blocks) {
    if (blocks == null || blocks.isEmpty()) {
      return Map.of();
    }
    List<Map<String, Object>> groups = new ArrayList<>();
    String goal = "";
    for (Map<String, Object> block : blocks) {
      if (goal.isEmpty()) {
        goal = mapText(block, "goal", "purpose");
      }
      groups.addAll(toObjectMapList(block.get("groups")));
    }
    Map<String, Object> merged = new LinkedHashMap<>();
    merged.put("block_name", expectedName);
    merged.put("goal", goal.isEmpty() ? blockGoal(expectedName, "Strength & Conditioning") : goal);
    merged.put("groups", groups);
    return merged;
  }

  private Map<String, Object> findMatchingFallbackBlock(
    List<Map<String, Object>> fallbackBlocks,
    String expected,
    boolean explicitStageFlow
  ) {
    for (Map<String, Object> fallback : fallbackBlocks) {
      String fallbackName = mapText(fallback, "block_name", "title", "name");
      if (planBlockMatchesExpected(fallbackName, expected, explicitStageFlow)) {
        return fallback;
      }
    }
    return null;
  }

  private boolean planBlockMatchesExpected(String actual, String expected, boolean explicitStageFlow) {
    String actualKey = courseBlockKey(actual);
    String expectedKey = courseBlockKey(expected);
    if (actualKey.isEmpty() || expectedKey.isEmpty()) {
      return false;
    }
    if (actualKey.equals(expectedKey)) {
      return true;
    }
    if ("main".equals(expectedKey) && explicitStageFlow && isMainWorkBlockKey(actualKey)) {
      return true;
    }
    if ("cooldown".equals(expectedKey) && ("stretch".equals(actualKey) || "relax".equals(actualKey))) {
      return true;
    }
    if ("relax".equals(expectedKey) && ("cooldown".equals(actualKey) || "stretch".equals(actualKey))) {
      return true;
    }
    return "strength".equals(expectedKey) && "main".equals(actualKey);
  }

  private boolean isMainWorkBlockKey(String key) {
    if (key == null || key.isBlank()) {
      return false;
    }
    return !List.of("warmup", "cooldown", "relax", "stretch", "breathing", "mobility", "flow")
      .contains(key);
  }

  private String courseBlockKey(String raw) {
    String value = normalizeString(raw).toLowerCase(Locale.ROOT);
    if (value.isEmpty()) return "";
    if (value.contains("warmup") || value.contains("warm up") || value.contains("热身") || value.contains("准备活动")) {
      return "warmup";
    }
    if (value.contains("assessment") || value.contains("screen") || value.contains("评估") || value.contains("筛查")) {
      return "assessment";
    }
    if (value.contains("activation") || value.contains("激活")) return "activation";
    if (value.contains("movement prep") || value.contains("动作准备")) return "movementprep";
    if (value.contains("breathing") || value.contains("breath") || value.contains("呼吸")) return "breathing";
    if (value.contains("speed") || value.contains("sprint") || value.contains("速度") || value.contains("冲刺")) {
      return "speed";
    }
    if (value.contains("agility") || value.contains("敏捷") || value.contains("变向")) return "agility";
    if (value.contains("power") || value.contains("plyo") || value.contains("explosive") || value.contains("爆发")) {
      return "power";
    }
    if (value.contains("skill") || value.contains("technique") || value.contains("技术")) return "skill";
    if (value.contains("compound") || value.contains("复合") || value.contains("主项")) return "compound";
    if (value.contains("secondary") || value.contains("次要")) return "secondary";
    if (value.contains("isolation") || value.contains("孤立")) return "isolation";
    if (value.contains("pump") || value.contains("泵感")) return "pump";
    if (value.contains("accessory") || value.contains("assistant") || value.contains("辅助")) return "accessory";
    if (value.contains("corrective") || value.contains("纠正") || value.contains("矫正")) return "corrective";
    if (value.contains("strength") || value.contains("力量")) return "strength";
    if (value.contains("conditioning") || value.contains("metcon") || value.contains("体能") || value.contains("有氧")) {
      return "conditioning";
    }
    if (value.contains("finisher") || value.contains("收尾")) return "finisher";
    if (value.contains("wod")) return "wod";
    if (value.contains("circuit") || value.contains("循环")) return "circuit";
    if (value.contains("mobility") || value.contains("活动度") || value.contains("灵活")) return "mobility";
    if (value.contains("flow") || value.contains("流动")) return "flow";
    if (value.contains("stretch") || value.contains("拉伸")) return "stretch";
    if (value.contains("cooldown") || value.contains("cool down") || value.contains("冷身") || value.contains("冷却")) {
      return "cooldown";
    }
    if (value.contains("relax") || value.contains("recovery") || value.contains("恢复") || value.contains("放松")) {
      return "relax";
    }
    if (
      value.contains("main training") ||
      value.contains("main work") ||
      value.contains("main set") ||
      value.contains("主训练") ||
      value.contains("主体训练") ||
      value.contains("训练主体")
    ) {
      return "main";
    }
    return normalizeForMatch(raw);
  }

  private boolean isGenericPlanExerciseName(String value) {
    String normalized = normalizeString(value).toLowerCase(Locale.ROOT).trim();
    if (normalized.isEmpty()) {
      return true;
    }
    return normalized.matches("^(exercise|鍔ㄤ綔)\\s*#?\\d+$") || isNarrativePlanExerciseLabel(normalized);
  }

  private boolean isNarrativePlanExerciseLabel(String normalized) {
    if (normalized.length() > 72) return true;
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
      if (normalized.contains(token)) {
        return true;
      }
    }
    long wordCount = normalized.isBlank() ? 0 : normalized.split("\\s+").length;
    if (wordCount > 8) return true;
    long cjkCount = normalized.chars()
      .filter(ch -> ch >= 0x4e00 && ch <= 0x9fa5)
      .count();
    return cjkCount > 18 && (normalized.contains("\uFF0C") || normalized.contains(",") || normalized.contains("\u3001"));
  }

  private boolean arePlanExerciseNamesCompatible(String intendedName, String catalogName) {
    if (isGenericPlanExerciseName(intendedName)) {
      return false;
    }
    String intended = normalizeForMatch(intendedName);
    String catalog = normalizeForMatch(catalogName);
    if (intended.isEmpty() || catalog.isEmpty()) {
      return false;
    }
    if (intended.equals(catalog) || intended.contains(catalog) || catalog.contains(intended)) {
      return true;
    }
    Set<String> intendedTokens = splitMatchTokens(intended);
    Set<String> catalogTokens = splitMatchTokens(catalog);
    if (intendedTokens.isEmpty() || catalogTokens.isEmpty()) {
      return false;
    }
    int overlap = 0;
    for (String token : intendedTokens) {
      if (catalogTokens.contains(token)) {
        overlap += 1;
      }
    }
    double coverage = (double) overlap / (double) intendedTokens.size();
    return overlap >= 2 && coverage >= 0.5d;
  }

  private ExerciseAssignment resolveAssignmentFromPlanNode(
    ContentAnalysisJob job,
    Map<String, Object> exerciseNode,
    List<ExerciseAssignment> exercisePool,
    Map<Long, ExerciseAssignment> poolById,
    List<ExerciseLite> activeExercises,
    Map<String, ExerciseAssignment> provisionCache
  ) {
    if (exerciseNode == null) {
      return null;
    }

    String rawName = firstNonBlank(
      mapText(exerciseNode, "exercise_name", "exerciseName", "name", "label"),
      ""
    );
    Long directId = readLongFromMap(exerciseNode, "exercise_id", "exerciseId", "id");
    boolean hasSpecificRawName = !rawName.isEmpty() && !isGenericPlanExerciseName(rawName);
    if (directId != null && directId > 0 && (rawName.isEmpty() || !isGenericPlanExerciseName(rawName))) {
      ExerciseAssignment byId = poolById.get(directId);
      if (byId != null) {
        if (!hasSpecificRawName || arePlanExerciseNamesCompatible(rawName, byId.exerciseName)) {
          return byId;
        }
      }
      ExerciseLite exercise = exerciseLiteMapper.selectById(directId);
      if (exercise != null && exercise.getId() != null && normalizeString(exercise.getName()).isEmpty() == false) {
        if (hasSpecificRawName && !arePlanExerciseNamesCompatible(rawName, exercise.getName())) {
          // The model can hallucinate a valid id while the name is the real movement intent.
          // Continue by name so we provision the intended exercise instead of opening a wrong detail page.
        } else {
        ExerciseAssignment created = new ExerciseAssignment(exercise.getId(), exercise.getName());
        poolById.put(created.exerciseId, created);
        exercisePool.add(created);
        return created;
        }
      }
    }

    if (rawName.isEmpty() || isGenericPlanExerciseName(rawName)) {
      return null;
    }

    String normalizedName = normalizeForMatch(rawName);
    if (normalizedName.isEmpty()) {
      return null;
    }
    ExerciseAssignment cached = provisionCache.get(normalizedName);
    if (cached != null) {
      return cached;
    }

    for (ExerciseAssignment item : exercisePool) {
      if (item == null) continue;
      String poolName = normalizeForMatch(item.exerciseName);
      if (poolName.isEmpty()) continue;
      if (poolName.equals(normalizedName) || poolName.contains(normalizedName) || normalizedName.contains(poolName)) {
        provisionCache.put(normalizedName, item);
        return item;
      }
    }

    ExerciseMatch best = findBestExerciseMatch(rawName, activeExercises);
    if (
      best != null &&
      best.exercise != null &&
      best.exercise.getId() != null &&
      best.score != null &&
      best.score.compareTo(BigDecimal.valueOf(86.00)) >= 0
    ) {
      ExerciseAssignment matched = new ExerciseAssignment(best.exercise.getId(), best.exercise.getName());
      if (!poolById.containsKey(matched.exerciseId)) {
        poolById.put(matched.exerciseId, matched);
        exercisePool.add(matched);
      }
      provisionCache.put(normalizedName, matched);
      return poolById.get(matched.exerciseId);
    }

    ExerciseAutoProvisionService.ProvisionResult provisionResult =
      exerciseAutoProvisionService.provisionFromLabel(job, rawName, "ai_plan_unmapped");
    if (provisionResult.success() && provisionResult.exerciseId() != null) {
      ExerciseLite created = exerciseLiteMapper.selectById(provisionResult.exerciseId());
      if (created != null && created.getId() != null && normalizeString(created.getName()).isEmpty() == false) {
        ExerciseAssignment added = new ExerciseAssignment(created.getId(), created.getName());
        if (!poolById.containsKey(added.exerciseId)) {
          poolById.put(added.exerciseId, added);
          exercisePool.add(added);
        }
        provisionCache.put(normalizedName, poolById.get(added.exerciseId));
        return poolById.get(added.exerciseId);
      }
    }

    return null;
  }

  private int defaultSetsForBlock(String blockName) {
    String key = normalizeForMatch(blockName);
    if (key.contains("warmup") || key.contains("activation")) return 2;
    if (key.contains("strength") || key.contains("compound") || key.contains("power") || key.contains("main")) return 4;
    if (key.contains("cooldown") || key.contains("stretch") || key.contains("relax")) return 1;
    return 3;
  }

  private int defaultRepsForBlock(String blockName, int indexInBlock) {
    String key = normalizeForMatch(blockName);
    if (key.contains("power")) return Math.max(3, 5 - indexInBlock);
    if (key.contains("cooldown") || key.contains("stretch") || key.contains("relax")) return 0;
    if (key.contains("conditioning") || key.contains("circuit") || key.contains("wod")) return 0;
    if (key.contains("main")) return 8 + Math.max(0, indexInBlock);
    if (key.contains("warmup") || key.contains("activation")) return 10 + Math.max(0, indexInBlock);
    return 8 + Math.max(0, indexInBlock);
  }

  private int defaultTimeForBlock(String blockName, int indexInBlock) {
    String key = normalizeForMatch(blockName);
    if (key.contains("conditioning") || key.contains("circuit") || key.contains("wod")) {
      return 40 + Math.max(0, indexInBlock) * 10;
    }
    if (key.contains("cooldown") || key.contains("stretch") || key.contains("relax")) {
      return 45;
    }
    return 0;
  }

  private boolean isLowQualityPlanStructure(Map<String, Object> structure, String planType) {
    List<Map<String, Object>> blocks = toObjectMapList(structure == null ? null : structure.get("blocks"));
    if (blocks.isEmpty()) {
      return true;
    }

    Map<Long, Integer> exerciseCounts = new HashMap<>();
    int totalRows = 0;
    int maxTimeSeconds = 0;
    for (Map<String, Object> block : blocks) {
      List<Map<String, Object>> groups = toObjectMapList(block.get("groups"));
      for (Map<String, Object> group : groups) {
        List<Map<String, Object>> exercises = toObjectMapList(group.get("exercises"));
        for (Map<String, Object> exercise : exercises) {
          Long id = readLongFromMap(exercise, "exercise_id", "exerciseId", "id");
          if (id == null || id <= 0) {
            continue;
          }
          totalRows += 1;
          exerciseCounts.put(id, (exerciseCounts.get(id) == null ? 0 : exerciseCounts.get(id)) + 1);
          int timeSeconds = readIntFromMap(exercise, 0, "time_seconds", "timeSeconds", "duration_seconds");
          maxTimeSeconds = Math.max(maxTimeSeconds, Math.max(0, timeSeconds));
        }
      }
    }

    if (totalRows <= 0) {
      return true;
    }
    int uniqueCount = exerciseCounts.size();
    int dominantCount = 0;
    for (Integer value : exerciseCounts.values()) {
      if (value != null && value > dominantCount) {
        dominantCount = value;
      }
    }
    double dominantShare = totalRows <= 0 ? 1.0d : (double) dominantCount / (double) totalRows;

    int requiredUnique = "module".equals(planType) ? 3 : 4;
    if (uniqueCount < requiredUnique && totalRows >= requiredUnique) return true;
    if (totalRows >= 8 && dominantShare >= 0.65d) return true;
    if (maxTimeSeconds > 600) return true;
    if (totalRows > 52) return true;
    return false;
  }

  private List<Map<String, Object>> toObjectMapList(Object raw) {
    if (!(raw instanceof List<?> list) || list.isEmpty()) {
      return List.of();
    }
    List<Map<String, Object>> rows = new ArrayList<>();
    for (Object item : list) {
      Map<String, Object> mapped = toObjectMap(item);
      if (!mapped.isEmpty()) {
        rows.add(mapped);
      }
    }
    return rows;
  }

  private Map<String, Object> toObjectMap(Object raw) {
    if (!(raw instanceof Map<?, ?> map) || map.isEmpty()) {
      return new LinkedHashMap<>();
    }
    Map<String, Object> row = new LinkedHashMap<>();
    for (Map.Entry<?, ?> entry : map.entrySet()) {
      if (entry.getKey() == null) {
        continue;
      }
      row.put(String.valueOf(entry.getKey()), entry.getValue());
    }
    return row;
  }

  private Long readLongFromMap(Map<String, Object> source, String... keys) {
    if (source == null || keys == null) {
      return null;
    }
    for (String key : keys) {
      Object value = source.get(key);
      if (value == null) {
        continue;
      }
      if (value instanceof Number number) {
        return number.longValue();
      }
      if (value instanceof String text) {
        String trimmed = text.trim();
        if (trimmed.isEmpty()) continue;
        try {
          return Long.parseLong(trimmed);
        } catch (NumberFormatException ignored) {
          // continue
        }
      }
    }
    return null;
  }

  private int readIntFromMap(Map<String, Object> source, int fallback, String... keys) {
    if (source == null || keys == null) {
      return fallback;
    }
    for (String key : keys) {
      Object value = source.get(key);
      if (value == null) {
        continue;
      }
      if (value instanceof Number number) {
        return number.intValue();
      }
      if (value instanceof String text) {
        String trimmed = text.trim();
        if (trimmed.isEmpty()) continue;
        try {
          return (int) Math.round(Double.parseDouble(trimmed));
        } catch (NumberFormatException ignored) {
          // continue
        }
      }
    }
    return fallback;
  }

  private BigDecimal readDecimalFromMap(Map<String, Object> source, BigDecimal fallback, String... keys) {
    BigDecimal safeFallback = fallback == null ? BigDecimal.ZERO : fallback;
    if (source == null || keys == null) {
      return safeFallback.setScale(2, RoundingMode.HALF_UP);
    }
    for (String key : keys) {
      Object value = source.get(key);
      if (value == null) {
        continue;
      }
      if (value instanceof BigDecimal decimal) {
        return decimal.setScale(2, RoundingMode.HALF_UP);
      }
      if (value instanceof Number number) {
        return BigDecimal.valueOf(number.doubleValue()).setScale(2, RoundingMode.HALF_UP);
      }
      if (value instanceof String text) {
        String trimmed = text.trim();
        if (trimmed.isEmpty()) continue;
        try {
          return new BigDecimal(trimmed).setScale(2, RoundingMode.HALF_UP);
        } catch (NumberFormatException ignored) {
          // continue
        }
      }
    }
    return safeFallback.setScale(2, RoundingMode.HALF_UP);
  }

  private int clampInt(int value, int min, int max) {
    if (value < min) return min;
    return Math.min(value, max);
  }

  private int clampOptions(Integer options) {
    if (options == null) {
      return 3;
    }
    if (options < 1) {
      return 1;
    }
    return Math.min(options, 5);
  }

  private boolean isSourceReconstructionRequest(ContentPlanGenerateRequest request) {
    String mode = normalizeString(request == null ? null : request.getGenerationMode()).toLowerCase(Locale.ROOT);
    String prompt = normalizeString(request == null ? null : request.getUserPrompt()).toLowerCase(Locale.ROOT);
    return mode.contains("source") ||
      mode.contains("reconstruct") ||
      prompt.contains("link_source_reconstruction") ||
      prompt.contains("source_reconstruction");
  }

  private String inferStyle(ContentAnalysisJob job, String styleHint) {
    String normalizedHint = normalizeString(styleHint);
    if (!normalizedHint.isEmpty() && !"auto".equalsIgnoreCase(normalizedHint)) {
      return canonicalStyle(normalizedHint);
    }

    Object structuredAnalysis = parseJsonSafely(job == null ? null : job.getAnalysisResultJson());
    String structuredStyle = mapText(structuredAnalysis, "style_hint", "style");
    if (!structuredStyle.isEmpty()) {
      return canonicalStyle(structuredStyle);
    }
    String structuredContentType = mapText(structuredAnalysis, "content_type", "plan_type_hint");
    if (!structuredContentType.isEmpty()) {
      String lowered = structuredContentType.toLowerCase(Locale.ROOT);
      if (lowered.contains("mobility")) return "Mobility / Yoga";
      if (lowered.contains("rehab")) return "Rehab";
      if (lowered.contains("metcon") || lowered.contains("condition")) return "Strength & Conditioning";
      if (lowered.contains("drill") || lowered.contains("athletic")) return "Athletic";
      if (lowered.contains("hypertrophy")) return "Bodybuilding";
      if (lowered.contains("functional") || lowered.contains("movement")) return "Functional";
    }

    String joined = (
      normalizeString(job.getSourceUrl()) + " "
        + normalizeString(job.getResultSummary()) + " "
        + normalizeString(job.getRequestPayload()) + " "
        + normalizeString(job.getAnalysisResultJson())
    ).toLowerCase(Locale.ROOT);

    if (containsAny(joined, List.of("hypertrophy", "aesthetic", "muscle", "bodybuilding", "增肌", "塑形"))) {
      return "Bodybuilding";
    }
    if (containsAny(joined, List.of("ankle", "stability", "rehab", "injury", "mobility", "恢复", "康复"))) {
      return "Functional";
    }
    if (containsAny(joined, List.of("fat", "cardio", "conditioning", "aerobic", "减脂", "有氧"))) {
      return "Strength & Conditioning";
    }
    if (containsAny(joined, List.of("crossfit", "wod"))) {
      return "CrossFit";
    }
    return "Strength & Conditioning";
  }

  private String canonicalStyle(String style) {
    String normalized = normalizeString(style).toLowerCase(Locale.ROOT);
    if (normalized.contains("body")) return "Bodybuilding";
    if (normalized.contains("cross")) return "CrossFit";
    if (normalized.contains("functional")) return "Functional";
    if (normalized.contains("mobility") || normalized.contains("yoga")) return "Mobility / Yoga";
    if (normalized.contains("athletic")) return "Athletic";
    if (normalized.contains("rehab")) return "Rehab";
    if (normalized.contains("strength") || normalized.contains("conditioning")) {
      return "Strength & Conditioning";
    }
    return style;
  }

  private List<ExerciseAssignment> resolveExerciseAssignments(Long jobId) {
    List<ContentMovementCandidate> candidates = candidateMapper.selectList(
      new LambdaQueryWrapper<ContentMovementCandidate>()
        .eq(ContentMovementCandidate::getJobId, jobId)
        .eq(ContentMovementCandidate::getIsDeleted, 0)
        .in(ContentMovementCandidate::getReviewState, Arrays.asList("accepted", "edited"))
        .orderByAsc(ContentMovementCandidate::getId)
    );

    if (candidates.isEmpty()) {
      return List.of();
    }

    List<ContentExerciseMapping> mappings = mappingMapper.selectList(
      new LambdaQueryWrapper<ContentExerciseMapping>()
        .eq(ContentExerciseMapping::getJobId, jobId)
        .eq(ContentExerciseMapping::getIsDeleted, 0)
        .orderByDesc(ContentExerciseMapping::getFinalSelected)
        .orderByDesc(ContentExerciseMapping::getMatchScore)
        .orderByAsc(ContentExerciseMapping::getId)
    );

    Map<Long, List<ContentExerciseMapping>> mappingByCandidate = new HashMap<>();
    for (ContentExerciseMapping mapping : mappings) {
      mappingByCandidate.computeIfAbsent(mapping.getCandidateId(), key -> new ArrayList<>()).add(mapping);
    }

    Set<Long> exerciseIds = new LinkedHashSet<>();
    for (List<ContentExerciseMapping> mappedList : mappingByCandidate.values()) {
      for (ContentExerciseMapping mapping : mappedList) {
        if (mapping.getExerciseId() != null) {
          exerciseIds.add(mapping.getExerciseId());
        }
      }
    }
    Map<Long, ExerciseLite> exerciseById = loadExercisesById(exerciseIds);

    List<ExerciseAssignment> assignments = new ArrayList<>();
    for (ContentMovementCandidate candidate : candidates) {
      List<ContentExerciseMapping> mappedList = mappingByCandidate.get(candidate.getId());
      if (mappedList == null || mappedList.isEmpty()) {
        continue;
      }
      ContentExerciseMapping selected = mappedList.get(0);
      for (ContentExerciseMapping row : mappedList) {
        int selectedFinal = selected.getFinalSelected() == null ? 0 : selected.getFinalSelected();
        int currentFinal = row.getFinalSelected() == null ? 0 : row.getFinalSelected();
        if (currentFinal > selectedFinal) {
          selected = row;
          continue;
        }
        if (currentFinal == selectedFinal) {
          BigDecimal selectedScore = selected.getMatchScore() == null ? BigDecimal.ZERO : selected.getMatchScore();
          BigDecimal currentScore = row.getMatchScore() == null ? BigDecimal.ZERO : row.getMatchScore();
          if (currentScore.compareTo(selectedScore) > 0) {
            selected = row;
          }
        }
      }

      ExerciseLite exercise = exerciseById.get(selected.getExerciseId());
      if (exercise == null || exercise.getName() == null) {
        continue;
      }
      assignments.add(new ExerciseAssignment(
        selected.getExerciseId(),
        exercise.getName(),
        candidate.getStartSec(),
        candidate.getEndSec(),
        candidate.getNotes()
      ));
    }

    if (!assignments.isEmpty()) {
      return assignments;
    }
    return List.of();
  }

  private boolean hasPendingCandidateReview(Long jobId) {
    Long count = candidateMapper.selectCount(
      new LambdaQueryWrapper<ContentMovementCandidate>()
        .eq(ContentMovementCandidate::getJobId, jobId)
        .eq(ContentMovementCandidate::getIsDeleted, 0)
        .in(ContentMovementCandidate::getReviewState, Arrays.asList("pending", "needs_review"))
    );
    return count != null && count > 0;
  }

  private List<String> blocksForRequestOrStyle(
    ContentAnalysisJob job,
    ContentPlanGenerateRequest request,
    String style,
    String planType
  ) {
    if ("module".equals(planType)) {
      return blocksForStyle(style, planType);
    }

    String combined = String.join(
      "\n",
      normalizeString(request == null ? null : request.getUserPrompt()),
      normalizeString(job == null ? null : job.getRequestPayload()),
      normalizeString(job == null ? null : job.getResultSummary())
    );
    List<String> requested = detectRequestedCourseBlocks(combined);
    if (!requested.isEmpty()) {
      return requested;
    }
    return blocksForStyle(style, planType);
  }

  private List<String> blocksForSourceReconstruction(
    String planType,
    List<ExerciseAssignment> sourceAssignments
  ) {
    if ("module".equals(planType)) {
      return sourceAssignments != null && sourceAssignments.size() >= 4
        ? List.of("Source Preparation", "Source Main Sequence")
        : List.of("Video Training Module");
    }
    List<String> inferred = inferSourceBlockTitles(sourceAssignments);
    if (!inferred.isEmpty()) {
      return inferred;
    }
    return List.of("Video Training Sequence");
  }

  private List<String> inferSourceBlockTitles(List<ExerciseAssignment> sourceAssignments) {
    if (sourceAssignments == null || sourceAssignments.size() < 4) {
      return List.of();
    }
    List<String> titles = new ArrayList<>();
    String last = "";
    for (int i = 0; i < sourceAssignments.size(); i += 1) {
      String title = sourceBlockTitleForAssignment(sourceAssignments.get(i), i, sourceAssignments.size());
      if (title.isBlank()) {
        continue;
      }
      if (!title.equals(last)) {
        titles.add(title);
        last = title;
      }
      if (titles.size() >= 5) {
        break;
      }
    }
    return titles.size() <= 1 ? List.of() : titles;
  }

  private String sourceBlockTitleForAssignment(
    ExerciseAssignment assignment,
    int index,
    int total
  ) {
    String text = (
      normalizeString(assignment == null ? null : assignment.exerciseName) + " " +
        normalizeString(assignment == null ? null : assignment.sourceNotes)
    ).toLowerCase(Locale.ROOT);
    if (text.contains("warm") || text.contains("prep") || text.contains("activation")) {
      return "Source Warmup / Activation";
    }
    if (text.contains("stretch") || text.contains("mobility") || text.contains("breath") || text.contains("cool")) {
      return index >= Math.max(1, total - 2) ? "Source Cooldown / Mobility" : "Source Mobility";
    }
    if (
      text.contains("burpee") ||
        text.contains("jump rope") ||
        text.contains("run") ||
        text.contains("bike") ||
        text.contains("swing") ||
        text.contains("carry") ||
        text.contains("conditioning")
    ) {
      return index == 0 ? "Source Warmup / Activation" : "Source Conditioning";
    }
    if (
      text.contains("jump") ||
        text.contains("sprint") ||
        text.contains("throw") ||
        text.contains("power") ||
        text.contains("explosive")
    ) {
      return "Source Power / Skill";
    }
    if (
      text.contains("press") ||
        text.contains("squat") ||
        text.contains("deadlift") ||
        text.contains("pull") ||
        text.contains("row") ||
        text.contains("lunge")
    ) {
      return "Source Strength / Skill";
    }
    if (index == 0 && total >= 5) {
      return "Source Preparation";
    }
    if (index >= Math.max(1, total - 1) && total >= 5) {
      return "Source Finisher / Recovery";
    }
    return "Source Main Sequence";
  }

  private String findSourceBlockTitle(
    List<String> availableBlocks,
    String preferredTitle,
    int index,
    int total
  ) {
    if (availableBlocks == null || availableBlocks.isEmpty()) {
      return firstNonBlank(preferredTitle, "Video Training Sequence");
    }
    String preferred = normalizeString(preferredTitle);
    if (!preferred.isEmpty()) {
      for (String block : availableBlocks) {
        if (normalizeForMatch(block).equals(normalizeForMatch(preferred))) {
          return block;
        }
      }
      String preferredKey = normalizeForMatch(preferred);
      for (String block : availableBlocks) {
        String blockKey = normalizeForMatch(block);
        if (!blockKey.isEmpty() && (blockKey.contains(preferredKey) || preferredKey.contains(blockKey))) {
          return block;
        }
      }
    }
    if (availableBlocks.size() == 1 || total <= 1) {
      return availableBlocks.get(0);
    }
    int bucket = (int) Math.floor(((double) Math.max(0, index) / (double) Math.max(1, total)) * availableBlocks.size());
    return availableBlocks.get(Math.max(0, Math.min(availableBlocks.size() - 1, bucket)));
  }

  private List<String> detectRequestedCourseBlocks(String raw) {
    String source = normalizeString(raw);
    if (source.isEmpty()) {
      return List.of();
    }
    String lower = source.toLowerCase(Locale.ROOT);
    boolean explicitStageLanguage =
      lower.contains("include") ||
      lower.contains("including") ||
      lower.contains("contains") ||
      lower.contains("consists of") ||
      lower.contains("split into") ||
      source.contains("包含") ||
      source.contains("包括") ||
      source.contains("分为") ||
      source.contains("分成") ||
      source.contains("阶段安排") ||
      source.contains("阶段包括") ||
      source.contains("训练阶段");
    if (!explicitStageLanguage) {
      return List.of();
    }
    boolean hasWarmup =
      lower.matches("(?s).*warm\\s*-?\\s*up.*") ||
      lower.contains("warmup") ||
      source.contains("热身") ||
      source.contains("准备活动");
    boolean hasMain =
      lower.contains("main training") ||
      lower.contains("main work") ||
      lower.contains("main set") ||
      lower.contains("main block") ||
      source.contains("主训练") ||
      source.contains("主体训练") ||
      source.contains("训练主体") ||
      source.contains("主要训练") ||
      (explicitStageLanguage &&
        (lower.contains("strength block") || source.contains("力量部分") || source.contains("训练部分")));
    boolean hasCooldown =
      lower.matches("(?s).*cool\\s*-?\\s*down.*") ||
      lower.contains("cooldown") ||
      lower.contains("recovery") ||
      lower.contains("stretching") ||
      source.contains("冷身") ||
      source.contains("冷却") ||
      source.contains("放松");
    if (hasWarmup && hasCooldown && !hasMain) {
      hasMain = true;
    }

    int count = 0;
    if (hasWarmup) count += 1;
    if (hasMain) count += 1;
    if (hasCooldown) count += 1;
    if (count < 2) {
      return List.of();
    }

    List<String> blocks = new ArrayList<>();
    if (hasWarmup) blocks.add("Warmup");
    if (hasMain) blocks.add("Main Training");
    if (hasCooldown) blocks.add("Cooldown");
    return blocks;
  }

  private List<String> blocksForStyle(String style, String planType) {
    if ("module".equals(planType)) {
      return switch (style) {
        case "Bodybuilding" -> List.of("Activation", "Pump Circuit", "Core Finish");
        case "CrossFit" -> List.of("Warmup", "WOD");
        case "Functional" -> List.of("Movement Prep", "Circuit", "Finisher");
        case "Mobility / Yoga" -> List.of("Breathing", "Flow", "Stretch");
        case "Athletic" -> List.of("Warmup", "Power", "Conditioning");
        case "Rehab" -> List.of("Assessment", "Corrective", "Mobility");
        default -> List.of("Warmup", "Strength", "Conditioning");
      };
    }

    return switch (style) {
      case "Bodybuilding" -> List.of("Warmup", "Compound", "Secondary", "Isolation", "Pump", "Cooldown");
      case "CrossFit" -> List.of("Warmup", "Skill", "Strength", "WOD", "Cooldown");
      case "Functional" -> List.of("Warmup", "Movement Prep", "Strength", "Circuit", "Finisher", "Cooldown");
      case "Mobility / Yoga" -> List.of("Breathing", "Mobility", "Flow", "Stretch", "Relax");
      case "Athletic" -> List.of("Warmup", "Speed", "Agility", "Power", "Strength", "Conditioning", "Cooldown");
      case "Rehab" -> List.of("Assessment", "Activation", "Corrective", "Strength", "Mobility");
      default -> List.of("Warmup", "Activation", "Power", "Strength", "Accessory", "Conditioning", "Cooldown");
    };
  }

  private Map<String, Object> buildPlanStructure(
    ContentAnalysisJob job,
    String planType,
    String style,
    int optionIndex,
    List<String> blocks,
    List<ExerciseAssignment> exercisePool,
    boolean sourceReconstruction
  ) {
    Map<String, Object> structure = new LinkedHashMap<>();
    structure.put("plan_type", planType);
    structure.put("session_scope", "single_session");
    structure.put("style", style);
    structure.put("title", sourceReconstruction ? buildSourcePlanTitle(planType, optionIndex) : buildPlanTitle(style, planType, optionIndex));
    structure.put("duration_min", "module".equals(planType) ? 25 + optionIndex * 3 : 45 + optionIndex * 5);
    structure.put("progression", sourceReconstruction ? buildSourcePlanProgression(planType) : buildProgression(planType, style, optionIndex));
    structure.put("safety_notes", buildSafetyNotes(job));

    if (sourceReconstruction) {
      List<String> sourceBlocks = blocks == null || blocks.isEmpty()
        ? List.of("module".equals(planType) ? "Video Training Module" : "Video Training Sequence")
        : blocks;
      Map<String, List<ExerciseAssignment>> assignmentsByBlock = new LinkedHashMap<>();
      for (String blockTitle : sourceBlocks) {
        assignmentsByBlock.put(blockTitle, new ArrayList<>());
      }

      int sourceLimit = Math.min(exercisePool.size(), 80);
      for (int i = 0; i < sourceLimit; i += 1) {
        ExerciseAssignment assignment = exercisePool.get(i);
        String inferredTitle = sourceBlockTitleForAssignment(assignment, i, sourceLimit);
        String targetTitle = findSourceBlockTitle(sourceBlocks, inferredTitle, i, sourceLimit);
        assignmentsByBlock.computeIfAbsent(targetTitle, key -> new ArrayList<>()).add(assignment);
      }

      List<Map<String, Object>> sourceBlockNodes = new ArrayList<>();
      for (Map.Entry<String, List<ExerciseAssignment>> entry : assignmentsByBlock.entrySet()) {
        if (entry.getValue().isEmpty()) {
          continue;
        }
        String blockName = entry.getKey();
        Map<String, Object> blockNode = new LinkedHashMap<>();
        blockNode.put("block_name", blockName);
        blockNode.put("goal", "Reconstruct the source video's demonstrated training sequence.");

        Map<String, Object> groupNode = new LinkedHashMap<>();
        String groupType = groupTypeFor(blockName);
        int rounds = roundsFor(blockName, planType, optionIndex);
        groupNode.put("group_type", groupType);
        groupNode.put("rounds", rounds);
        groupNode.put("rest_seconds", restForGroup(groupType, blockName));

        List<Map<String, Object>> exerciseNodes = new ArrayList<>();
        for (int i = 0; i < entry.getValue().size(); i += 1) {
          exerciseNodes.add(buildExerciseNode(entry.getValue().get(i), blockName, groupType, rounds, optionIndex, i, true));
        }
        groupNode.put("exercises", exerciseNodes);
        blockNode.put("groups", List.of(groupNode));
        sourceBlockNodes.add(blockNode);
      }
      if (sourceBlockNodes.isEmpty()) {
        throw new IllegalArgumentException("No source exercise mapping available. Please review the parsed video candidates first.");
      }
      structure.put("blocks", sourceBlockNodes);
      return structure;
    }

    List<Map<String, Object>> blockNodes = new ArrayList<>();
    int stride = Math.max(2, Math.max(1, exercisePool.size() / 3));
    int pointer = (optionIndex - 1) * stride;
    for (int blockIndex = 0; blockIndex < blocks.size(); blockIndex += 1) {
      String blockName = blocks.get(blockIndex);
      Map<String, Object> blockNode = new LinkedHashMap<>();
      blockNode.put("block_name", blockName);
      blockNode.put("goal", blockGoal(blockName, style));

      Map<String, Object> groupNode = new LinkedHashMap<>();
      String groupType = sourceReconstruction
        ? groupTypeFor(blockName)
        : variantGroupTypeFor(courseBlockKey(blockName), groupTypeFor(blockName), planVariantKey(optionIndex));
      int rounds = roundsFor(blockName, planType, optionIndex);
      groupNode.put("group_type", groupType);
      groupNode.put("rounds", rounds);
      groupNode.put(
        "rest_seconds",
        sourceReconstruction
          ? restForGroup(groupType, blockName)
          : variantRestForGroup(courseBlockKey(blockName), groupType, planVariantKey(optionIndex), restForGroup(groupType, blockName))
      );

      List<Map<String, Object>> exerciseNodes = new ArrayList<>();
      int exercisesPerBlock = exercisesPerBlock(blockName, groupType);
      for (int i = 0; i < exercisesPerBlock; i += 1) {
        ExerciseAssignment assignment = exercisePool.get(pointer % exercisePool.size());
        pointer += 1;
        exerciseNodes.add(buildExerciseNode(assignment, blockName, groupType, rounds, optionIndex, i, sourceReconstruction));
      }
      groupNode.put("exercises", exerciseNodes);
      blockNode.put("groups", List.of(groupNode));
      blockNodes.add(blockNode);
    }

    structure.put("blocks", blockNodes);
    return structure;
  }

  private String planVariantKey(int optionIndex) {
    int normalized = Math.floorMod(Math.max(1, optionIndex) - 1, 3);
    return switch (normalized) {
      case 1 -> "volume_control";
      case 2 -> "power_density";
      default -> "technique_strength";
    };
  }

  private String planVariantLabel(int optionIndex) {
    return switch (planVariantKey(optionIndex)) {
      case "volume_control" -> "Volume Control";
      case "power_density" -> "Power Density";
      default -> "Technique Strength";
    };
  }

  private String appendVariantLabelToTitle(String title, int optionIndex) {
    String safe = firstNonBlank(title, "Training Option " + optionIndex);
    String label = planVariantLabel(optionIndex);
    if (safe.toLowerCase(Locale.ROOT).contains(label.toLowerCase(Locale.ROOT))) {
      return safe;
    }
    return safe + " - " + label;
  }

  private String buildPlanTitle(String style, String planType, int optionIndex) {
    String suffix = "module".equals(planType) ? "Quick Module Session" : "Training Course Session";
    return "%s %s Option %d - %s".formatted(style, suffix, optionIndex, planVariantLabel(optionIndex));
  }

  private String buildSourcePlanTitle(String planType, int optionIndex) {
    String suffix = "module".equals(planType) ? "Video Training Module" : "Video Training Course";
    return optionIndex <= 1 ? "Source " + suffix : "Source " + suffix + " " + optionIndex;
  }

  private String buildPlanSummary(String style, String planType, int optionIndex, int blockCount) {
    return "Option %d (%s) delivers one %s %s session with %d structured blocks."
      .formatted(optionIndex, planVariantLabel(optionIndex), style, planType, blockCount);
  }

  private Object parseJsonSafely(String json) {
    if (json == null || json.isBlank()) {
      return null;
    }
    try {
      return objectMapper.readValue(json, Object.class);
    } catch (Exception ex) {
      return json;
    }
  }

  private List<ContentPlanDraftResponse> toPlanResponses(List<ContentPlanDraft> plans) {
    List<ContentPlanDraftResponse> responses = new ArrayList<>();
    for (ContentPlanDraft plan : plans) {
      ContentPlanDraftResponse response = new ContentPlanDraftResponse();
      response.setPlanId(plan.getId());
      response.setPlanType(plan.getPlanType());
      response.setOptionIndex(plan.getOptionIndex());
      response.setStyle(plan.getStyle());
      response.setTitle(plan.getTitle());
      response.setSummary(plan.getSummary());
      response.setStatusLabel(plan.getStatusLabel());
      response.setStructure(parseJsonSafely(plan.getStructureJson()));
      responses.add(response);
    }
    return responses;
  }

  private String buildProgression(String planType, String style, int optionIndex) {
    String variant = planVariantKey(optionIndex);
    if ("module".equals(planType)) {
      if ("volume_control".equals(variant)) {
        return "Use controlled tempo and moderate rest. Next time, add 1-2 reps per movement before increasing load.";
      }
      if ("power_density".equals(variant)) {
        return "Keep every rep crisp. Next time, add one round or shorten rest only if output quality remains high.";
      }
      return "Keep RPE 6-8. In your next session, add one round or +2 reps only if technique stays stable.";
    }
    if ("Rehab".equals(style) || "Functional".equals(style)) {
      if ("volume_control".equals(variant)) {
        return "Accumulate quality volume without pain; next time add range or reps before adding load.";
      }
      if ("power_density".equals(variant)) {
        return "Use low-impact power and short density blocks only if alignment stays clean.";
      }
      return "Prioritize pattern quality first, then increase controlled range or load by 5-8% in the next session.";
    }
    if ("volume_control".equals(variant)) {
      return "Build volume with clean reps; next time add one set to secondary work or +2 reps before load jumps.";
    }
    if ("power_density".equals(variant)) {
      return "Prioritize fast intent and density; next time add one interval round before increasing load.";
    }
    return "Establish clean base volume, then add 2-5% load or one extra set on primary blocks in the next session.";
  }

  private String buildSourcePlanProgression(String planType) {
    if ("module".equals(planType)) {
      return "Follow the source video's movement order first; adjust rounds or rest only after technique is stable.";
    }
    return "Use the source video as the session blueprint; keep the demonstrated sequence and scale volume to the user's level.";
  }

  private List<String> buildSafetyNotes(ContentAnalysisJob job) {
    String payload = normalizeString(job.getRequestPayload()).toLowerCase(Locale.ROOT);
    if (containsAny(payload, List.of("injury", "pain", "rehab", "knee", "ankle", "back", "历史"))) {
      return List.of(
        "Pain should remain <= 3/10 during movement.",
        "Reduce range or load immediately if compensation appears.",
        "Prioritize control and tempo over intensity progression."
      );
    }
    return List.of(
      "Use full controlled range only when joint alignment remains stable.",
      "Keep 1-3 reps in reserve on primary sets.",
      "Stop set if technique breaks before target reps."
    );
  }

  private String blockGoal(String blockName, String style) {
    String key = blockName.toLowerCase(Locale.ROOT);
    if (key.contains("warmup")) return "Raise core temperature and prepare joints.";
    if (key.contains("activation")) return "Prime key muscle groups and movement pattern.";
    if (key.contains("power")) return "Develop force production and rate of force.";
    if (key.contains("strength") || key.contains("compound") || key.contains("main")) return "Build high-quality mechanical tension.";
    if (key.contains("isolation") || key.contains("pump")) return "Accumulate targeted hypertrophy volume.";
    if (key.contains("circuit") || key.contains("conditioning") || key.contains("wod")) {
      return "Increase work capacity with structured density.";
    }
    if (key.contains("cooldown") || key.contains("stretch") || key.contains("relax")) {
      return "Down-regulate and recover tissue readiness.";
    }
    if (key.contains("mobility") || key.contains("flow")) return "Expand usable ROM with control.";
    if (key.contains("assessment")) return "Check baseline movement quality before load.";
    return "%s focused training progression.".formatted(style);
  }

  private String groupTypeFor(String blockName) {
    String key = blockName.toLowerCase(Locale.ROOT);
    if (key.contains("circuit") || key.contains("conditioning") || key.contains("wod")) {
      return "circuit";
    }
    if (key.contains("pump") || key.contains("isolation")) {
      return "superset";
    }
    if (key.contains("flow") || key.contains("mobility") || key.contains("stretch") || key.contains("relax")) {
      return "flow";
    }
    return "straight_sets";
  }

  private int roundsFor(String blockName, String planType, int optionIndex) {
    String key = blockName.toLowerCase(Locale.ROOT);
    if (key.contains("circuit") || key.contains("conditioning") || key.contains("wod")) {
      return Math.min(6, 2 + optionIndex);
    }
    if ("module".equals(planType)) {
      return 2 + Math.max(0, optionIndex - 1);
    }
    return 1;
  }

  private int restForGroup(String groupType, String blockName) {
    if ("circuit".equals(groupType)) {
      return 60;
    }
    if ("superset".equals(groupType)) {
      return 45;
    }
    if ("flow".equals(groupType)) {
      return 20;
    }
    String key = blockName.toLowerCase(Locale.ROOT);
    if (key.contains("power")) return 120;
    if (key.contains("strength") || key.contains("compound") || key.contains("main")) return 105;
    return 75;
  }

  private int exercisesPerBlock(String blockName, String groupType) {
    String key = blockName.toLowerCase(Locale.ROOT);
    if (key.contains("assessment")) return 1;
    if (key.contains("cooldown") || key.contains("stretch") || key.contains("relax")) return 1;
    if ("flow".equals(groupType)) return 2;
    if ("circuit".equals(groupType)) return 3;
    return 2;
  }

  private Map<String, Object> buildExerciseNode(
    ExerciseAssignment assignment,
    String blockName,
    String groupType,
    int rounds,
    int optionIndex,
    int indexInBlock,
    boolean sourceReconstruction
  ) {
    Map<String, Object> exercise = new LinkedHashMap<>();
    exercise.put("exercise_id", assignment.exerciseId);
    exercise.put("exercise_name", assignment.exerciseName);

    String key = blockName.toLowerCase(Locale.ROOT);
    int sets;
    int reps;
    int restSeconds;
    int timeSeconds;
    String tempo;
    int rnd = rounds;

    if (key.contains("warmup") || key.contains("activation")) {
      sets = 2;
      reps = 10 + indexInBlock * 2;
      restSeconds = 30;
      timeSeconds = 0;
      tempo = "controlled";
    } else if (key.contains("power")) {
      sets = 4;
      reps = 3 + indexInBlock;
      restSeconds = 90;
      timeSeconds = 0;
      tempo = "explosive";
    } else if (key.contains("strength") || key.contains("compound") || key.contains("main")) {
      sets = 4 + Math.min(optionIndex - 1, 1);
      reps = 5 + indexInBlock;
      restSeconds = 120;
      timeSeconds = 0;
      tempo = "2-0-1";
    } else if (key.contains("secondary") || key.contains("isolation") || key.contains("pump")) {
      sets = 3;
      reps = 10 + indexInBlock * 2;
      restSeconds = 45;
      timeSeconds = 0;
      tempo = "3-1-1";
    } else if (key.contains("conditioning") || key.contains("wod") || key.contains("circuit")) {
      sets = 1;
      reps = 0;
      restSeconds = 40;
      timeSeconds = 40 + indexInBlock * 10;
      tempo = "sustained";
    } else if (key.contains("cooldown") || key.contains("stretch") || key.contains("relax")) {
      sets = 1;
      reps = 0;
      restSeconds = 20;
      timeSeconds = 50;
      tempo = "slow-breath";
      rnd = 1;
    } else if (key.contains("mobility") || key.contains("flow")) {
      sets = 2;
      reps = 6 + indexInBlock * 2;
      restSeconds = 25;
      timeSeconds = 0;
      tempo = "controlled";
    } else if (key.contains("assessment")) {
      sets = 1;
      reps = 5;
      restSeconds = 30;
      timeSeconds = 0;
      tempo = "quality";
      rnd = 1;
    } else {
      sets = 3;
      reps = 8;
      restSeconds = 60;
      timeSeconds = 0;
      tempo = "controlled";
    }

    exercise.put("sets", sets);
    exercise.put("reps", reps);
    exercise.put("rest_seconds", restSeconds);
    exercise.put("time_seconds", timeSeconds);
    exercise.put("tempo", tempo);
    exercise.put("rnd", rnd);
    exercise.put("group_hint", groupType);
    if (sourceReconstruction) {
      applySourceNoteMetrics(exercise, assignment.sourceNotes);
    }
    if (!sourceReconstruction) {
      applyPlanVariantToExercise(exercise, courseBlockKey(blockName), groupType, planVariantKey(optionIndex), rounds);
    }
    return exercise;
  }

  private void applySourceNoteMetrics(Map<String, Object> exercise, String sourceNotes) {
    String notes = normalizeString(sourceNotes);
    if (notes.isEmpty()) {
      return;
    }
    int sets = parseMetricFromNotes(notes, "sets");
    int reps = parseMetricFromNotes(notes, "reps");
    int timeSeconds = parseMetricFromNotes(notes, "time_seconds");
    if (sets > 0) {
      exercise.put("sets", clampInt(sets, 1, 6));
    }
    if (reps > 0) {
      exercise.put("reps", clampInt(reps, 0, 25));
    }
    if (timeSeconds > 0) {
      exercise.put("time_seconds", clampInt(timeSeconds, 0, 360));
    }
  }

  private int parseMetricFromNotes(String sourceNotes, String key) {
    String notes = normalizeString(sourceNotes);
    String metric = normalizeString(key);
    if (notes.isEmpty() || metric.isEmpty()) {
      return 0;
    }
    Pattern pattern = Pattern.compile("(?i)(?:^|\\s)" + Pattern.quote(metric) + "=(\\d{1,4})(?:\\s|$)");
    Matcher matcher = pattern.matcher(notes);
    if (!matcher.find()) {
      return 0;
    }
    try {
      return Integer.parseInt(matcher.group(1));
    } catch (NumberFormatException ignored) {
      return 0;
    }
  }

  private boolean containsAny(String source, List<String> keywords) {
    if (source == null || source.isBlank() || keywords == null || keywords.isEmpty()) {
      return false;
    }
    for (String keyword : keywords) {
      if (source.contains(keyword)) {
        return true;
      }
    }
    return false;
  }

  private String truncate(String value, int maxLength) {
    if (value == null || value.length() <= maxLength) {
      return value;
    }
    return value.substring(0, maxLength);
  }

  private static class KeywordRule {
    private final String label;
    private final List<String> keywords;

    private KeywordRule(String label, List<String> keywords) {
      this.label = label;
      this.keywords = keywords;
    }
  }

  private static class GeneratedCandidateSeed {
    private final String label;
    private final BigDecimal startSec;
    private final BigDecimal endSec;
    private final BigDecimal confidence;
    private final String reason;

    private GeneratedCandidateSeed(
      String label,
      BigDecimal startSec,
      BigDecimal endSec,
      BigDecimal confidence,
      String reason
    ) {
      this.label = label;
      this.startSec = startSec;
      this.endSec = endSec;
      this.confidence = confidence;
      this.reason = reason;
    }
  }

  private static class ExerciseAssignment {
    private final Long exerciseId;
    private final String exerciseName;
    private final BigDecimal startSec;
    private final BigDecimal endSec;
    private final String sourceNotes;

    private ExerciseAssignment(Long exerciseId, String exerciseName) {
      this(exerciseId, exerciseName, null, null, "");
    }

    private ExerciseAssignment(
      Long exerciseId,
      String exerciseName,
      BigDecimal startSec,
      BigDecimal endSec,
      String sourceNotes
    ) {
      this.exerciseId = exerciseId;
      this.exerciseName = exerciseName;
      this.startSec = startSec;
      this.endSec = endSec;
      this.sourceNotes = sourceNotes == null ? "" : sourceNotes.trim();
    }
  }

  private static class ExerciseMatch {
    private final ExerciseLite exercise;
    private final BigDecimal score;

    private ExerciseMatch(ExerciseLite exercise, BigDecimal score) {
      this.exercise = exercise;
      this.score = score == null ? BigDecimal.ZERO : score;
    }
  }
}
