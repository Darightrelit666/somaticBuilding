package com.somaticbuilding.assessment.interfaces.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public class StepRequest {
  @NotNull
  private Long sessionId;
  @NotBlank
  private String stepType;
  @NotNull
  private Integer stepStatus;

  public Long getSessionId() {
    return sessionId;
  }

  public void setSessionId(Long sessionId) {
    this.sessionId = sessionId;
  }

  public String getStepType() {
    return stepType;
  }

  public void setStepType(String stepType) {
    this.stepType = stepType;
  }

  public Integer getStepStatus() {
    return stepStatus;
  }

  public void setStepStatus(Integer stepStatus) {
    this.stepStatus = stepStatus;
  }
}
