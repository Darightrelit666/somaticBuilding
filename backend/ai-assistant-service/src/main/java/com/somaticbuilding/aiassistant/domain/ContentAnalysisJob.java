package com.somaticbuilding.aiassistant.domain;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@TableName("content_analysis_job")
public class ContentAnalysisJob {
  @TableId(type = IdType.AUTO)
  private Long id;
  private Long userId;
  private String sourcePlatform;
  private String sourceUrl;
  private String sourceVideoId;
  private String analysisMode;
  private String goalType;
  private String pipelineStatus;
  private String errorCode;
  private String errorMessage;
  private BigDecimal confidenceScore;
  private String requestPayload;
  private String analysisResultJson;
  private String resultSummary;
  private Integer status;
  private LocalDateTime createTime;
  private LocalDateTime updateTime;
  private Integer isDeleted;

  public Long getId() {
    return id;
  }

  public void setId(Long id) {
    this.id = id;
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

  public String getRequestPayload() {
    return requestPayload;
  }

  public void setRequestPayload(String requestPayload) {
    this.requestPayload = requestPayload;
  }

  public String getAnalysisResultJson() {
    return analysisResultJson;
  }

  public void setAnalysisResultJson(String analysisResultJson) {
    this.analysisResultJson = analysisResultJson;
  }

  public String getResultSummary() {
    return resultSummary;
  }

  public void setResultSummary(String resultSummary) {
    this.resultSummary = resultSummary;
  }

  public Integer getStatus() {
    return status;
  }

  public void setStatus(Integer status) {
    this.status = status;
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

  public Integer getIsDeleted() {
    return isDeleted;
  }

  public void setIsDeleted(Integer isDeleted) {
    this.isDeleted = isDeleted;
  }
}

