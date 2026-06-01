package com.somaticbuilding.workout.interfaces.dto;

import jakarta.validation.constraints.NotBlank;

public class SessionUpdateRequest {
  @NotBlank
  private String sessionName;
  @NotBlank
  private String trainingStyle;

  public String getSessionName() {
    return sessionName;
  }

  public void setSessionName(String sessionName) {
    this.sessionName = sessionName;
  }

  public String getTrainingStyle() {
    return trainingStyle;
  }

  public void setTrainingStyle(String trainingStyle) {
    this.trainingStyle = trainingStyle;
  }
}
