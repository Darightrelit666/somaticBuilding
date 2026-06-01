package com.somaticbuilding.aiassistant.interfaces.dto;

import com.fasterxml.jackson.annotation.JsonAlias;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

public class ContentJobResponse {
  @JsonAlias("job_id")
  private Long jobId;
  @JsonAlias("user_id")
  private Long userId;
  @JsonAlias("source_platform")
  private String sourcePlatform;
  @JsonAlias("source_url")
  private String sourceUrl;
  @JsonAlias("source_video_id")
  private String sourceVideoId;
  @JsonAlias("analysis_mode")
  private String analysisMode;
  @JsonAlias("goal_type")
  private String goalType;
  @JsonAlias("pipeline_status")
  private String pipelineStatus;
  @JsonAlias("error_code")
  private String errorCode;
  @JsonAlias("error_message")
  private String errorMessage;
  @JsonAlias("confidence_score")
  private BigDecimal confidenceScore;
  @JsonAlias("result_summary")
  private String resultSummary;
  @JsonAlias("analysis_result_json")
  private String analysisResultJson;
  @JsonAlias("required_material")
  private List<String> requiredMaterial = new ArrayList<>();
  @JsonAlias("material_count")
  private Integer materialCount;
  @JsonAlias("candidate_count")
  private Integer candidateCount;
  @JsonAlias("plan_count")
  private Integer planCount;
  @JsonAlias("create_time")
  private LocalDateTime createTime;
  @JsonAlias("update_time")
  private LocalDateTime updateTime;

  public Long getJobId() {
    return jobId;
  }

  public void setJobId(Long jobId) {
    this.jobId = jobId;
  }

  public Long getUserId() {
    return userId;
  }

  public void setUserId(Long userId) {
    this.userId = userId;
  }

  public String getSourcePlatform() {
    return sourcePlatform;
  }

  public void setSourcePlatform(String sourcePlatform) {
    this.sourcePlatform = sourcePlatform;
  }

  public String getSourceUrl() {
    return sourceUrl;
  }

  public void setSourceUrl(String sourceUrl) {
    this.sourceUrl = sourceUrl;
  }

  public String getSourceVideoId() {
    return sourceVideoId;
  }

  public void setSourceVideoId(String sourceVideoId) {
    this.sourceVideoId = sourceVideoId;
  }

  public String getAnalysisMode() {
    return analysisMode;
  }

  public void setAnalysisMode(String analysisMode) {
    this.analysisMode = analysisMode;
  }

  public String getGoalType() {
    return goalType;
  }

  public void setGoalType(String goalType) {
    this.goalType = goalType;
  }

  public String getPipelineStatus() {
    return pipelineStatus;
  }

  public void setPipelineStatus(String pipelineStatus) {
    this.pipelineStatus = pipelineStatus;
  }

  public String getErrorCode() {
    return errorCode;
  }

  public void setErrorCode(String errorCode) {
    this.errorCode = errorCode;
  }

  public String getErrorMessage() {
    return errorMessage;
  }

  public void setErrorMessage(String errorMessage) {
    this.errorMessage = errorMessage;
  }

  public BigDecimal getConfidenceScore() {
    return confidenceScore;
  }

  public void setConfidenceScore(BigDecimal confidenceScore) {
    this.confidenceScore = confidenceScore;
  }

  public String getResultSummary() {
    return resultSummary;
  }

  public void setResultSummary(String resultSummary) {
    this.resultSummary = resultSummary;
  }

  public String getAnalysisResultJson() {
    return analysisResultJson;
  }

  public void setAnalysisResultJson(String analysisResultJson) {
    this.analysisResultJson = analysisResultJson;
  }

  public List<String> getRequiredMaterial() {
    return requiredMaterial;
  }

  public void setRequiredMaterial(List<String> requiredMaterial) {
    this.requiredMaterial = requiredMaterial == null ? new ArrayList<>() : requiredMaterial;
  }

  public Integer getMaterialCount() {
    return materialCount;
  }

  public void setMaterialCount(Integer materialCount) {
    this.materialCount = materialCount;
  }

  public Integer getCandidateCount() {
    return candidateCount;
  }

  public void setCandidateCount(Integer candidateCount) {
    this.candidateCount = candidateCount;
  }

  public Integer getPlanCount() {
    return planCount;
  }

  public void setPlanCount(Integer planCount) {
    this.planCount = planCount;
  }

  public LocalDateTime getCreateTime() {
    return createTime;
  }

  public void setCreateTime(LocalDateTime createTime) {
    this.createTime = createTime;
  }

  public LocalDateTime getUpdateTime() {
    return updateTime;
  }

  public void setUpdateTime(LocalDateTime updateTime) {
    this.updateTime = updateTime;
  }
}
