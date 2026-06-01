package com.somaticbuilding.workout.interfaces.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.util.List;

public class SessionCreateRequest {
  @NotNull
  private Long userId;
  @NotBlank
  private String sessionName;
  @NotBlank
  private String trainingStyle;
  private List<String> blockNames;
  private Long templateId;

  public Long getUserId() {
    return userId;
  }

  public void setUserId(Long userId) {
    this.userId = userId;
  }

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

  public List<String> getBlockNames() {
    return blockNames;
  }

  public void setBlockNames(List<String> blockNames) {
    this.blockNames = blockNames;
  }

  public Long getTemplateId() {
    return templateId;
  }

  public void setTemplateId(Long templateId) {
    this.templateId = templateId;
  }
}
