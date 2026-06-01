package com.somaticbuilding.aiassistant.interfaces;

import com.somaticbuilding.aiassistant.application.ContentAnalysisService;
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
import com.somaticbuilding.common.core.ApiResponse;
import jakarta.validation.Valid;
import org.springframework.core.io.Resource;
import org.springframework.core.io.UrlResource;
import org.springframework.http.CacheControl;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.net.MalformedURLException;
import java.nio.file.Path;
import java.util.concurrent.TimeUnit;
import java.util.List;

@RestController
@RequestMapping("/api/v1/assistant/content")
public class ContentAnalysisController {
  private final ContentAnalysisService contentAnalysisService;

  public ContentAnalysisController(ContentAnalysisService contentAnalysisService) {
    this.contentAnalysisService = contentAnalysisService;
  }

  @PostMapping("/jobs")
  public ApiResponse<ContentJobCreateResponse> createJob(
    @Valid @RequestBody ContentJobCreateRequest request
  ) {
    return ApiResponse.success(contentAnalysisService.createJob(request));
  }

  @PostMapping("/jobs/{jobId}/materials")
  public ApiResponse<ContentMaterialAddResponse> addMaterials(
    @PathVariable("jobId") Long jobId,
    @Valid @RequestBody ContentMaterialAddRequest request
  ) {
    return ApiResponse.success(contentAnalysisService.addMaterials(jobId, request));
  }

  @PostMapping("/jobs/{jobId}/analyze")
  public ApiResponse<ContentJobResponse> startAnalyze(@PathVariable("jobId") Long jobId) {
    return ApiResponse.success(contentAnalysisService.startAnalyze(jobId));
  }

  @GetMapping("/jobs/{jobId}")
  public ApiResponse<ContentJobResponse> getJob(@PathVariable("jobId") Long jobId) {
    return ApiResponse.success(contentAnalysisService.getJob(jobId));
  }

  @GetMapping("/jobs/{jobId}/assets/{assetId}/file")
  public ResponseEntity<Resource> getFrameAssetFile(
    @PathVariable("jobId") Long jobId,
    @PathVariable("assetId") Long assetId
  ) throws MalformedURLException {
    Path path = contentAnalysisService.getFrameAssetFile(jobId, assetId);
    Resource resource = new UrlResource(path.toUri());
    return ResponseEntity.ok()
      .contentType(MediaType.IMAGE_JPEG)
      .cacheControl(CacheControl.maxAge(10, TimeUnit.MINUTES))
      .body(resource);
  }

  @GetMapping("/jobs/{jobId}/candidates")
  public ApiResponse<List<ContentCandidateResponse>> listCandidates(@PathVariable("jobId") Long jobId) {
    return ApiResponse.success(contentAnalysisService.listCandidates(jobId));
  }

  @PostMapping("/jobs/{jobId}/candidates/review")
  public ApiResponse<ContentCandidateReviewResponse> reviewCandidates(
    @PathVariable("jobId") Long jobId,
    @Valid @RequestBody ContentCandidateReviewRequest request
  ) {
    return ApiResponse.success(contentAnalysisService.reviewCandidates(jobId, request));
  }

  @PostMapping("/jobs/{jobId}/plans/generate")
  public ApiResponse<List<ContentPlanDraftResponse>> generatePlans(
    @PathVariable("jobId") Long jobId,
    @RequestBody(required = false) ContentPlanGenerateRequest request
  ) {
    return ApiResponse.success(contentAnalysisService.generatePlans(jobId, request));
  }

  @GetMapping("/jobs/{jobId}/plans")
  public ApiResponse<List<ContentPlanDraftResponse>> listPlans(@PathVariable("jobId") Long jobId) {
    return ApiResponse.success(contentAnalysisService.listPlans(jobId));
  }

  @PostMapping("/jobs/{jobId}/plans/{planId}/apply")
  public ApiResponse<ContentPlanApplyResponse> applyPlan(
    @PathVariable("jobId") Long jobId,
    @PathVariable("planId") Long planId,
    @RequestBody(required = false) ContentPlanApplyRequest request
  ) {
    return ApiResponse.success(contentAnalysisService.applyPlan(jobId, planId, request));
  }

  @PostMapping("/plans/apply-direct")
  public ApiResponse<ContentPlanApplyResponse> applyDirectPlan(
    @Valid @RequestBody ContentPlanDirectApplyRequest request
  ) {
    return ApiResponse.success(contentAnalysisService.applyDirectPlan(request));
  }
}
