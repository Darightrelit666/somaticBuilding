package com.somaticbuilding.aiassistant.interfaces.dto;

import com.fasterxml.jackson.annotation.JsonAlias;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.util.Map;

public class ContentJobCreateRequest {
  @NotNull
  @JsonAlias("user_id")
  private Long userId;

  @NotBlank
  @JsonAlias("source_url")
  private String sourceUrl;

  @JsonAlias("goal_type")
  private String goalType;

  @JsonAlias("analysis_mode")
  private String analysisMode;

  @JsonAlias("user_constraints")
  private Map<String, Object> userConstraints;

  public Long getUserId() {
    return userId;
  }

  public void setUserId(Long userId) {
    this.userId = userId;
  }

  public String getSourceUrl() {
    return sourceUrl;
  }

  public void setSourceUrl(String sourceUrl) {
    this.sourceUrl = sourceUrl;
  }

  public String getGoalType() {
    return goalType;
  }

  public void setGoalType(String goalType) {
    this.goalType = goalType;
  }

  public String getAnalysisMode() {
    return analysisMode;
  }

  public void setAnalysisMode(String analysisMode) {
    this.analysisMode = analysisMode;
  }

  public Map<String, Object> getUserConstraints() {
    return userConstraints;
  }

  public void setUserConstraints(Map<String, Object> userConstraints) {
    this.userConstraints = userConstraints;
  }
}

