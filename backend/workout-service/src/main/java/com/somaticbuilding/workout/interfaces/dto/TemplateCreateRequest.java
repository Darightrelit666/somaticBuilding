package com.somaticbuilding.workout.interfaces.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.util.List;

public class TemplateCreateRequest {
  @NotNull
  private Long userId;
  @NotBlank
  private String templateName;
  private String templateKind;
  private List<TemplateExerciseRequest> exercises;

  public Long getUserId() {
    return userId;
  }

  public void setUserId(Long userId) {
    this.userId = userId;
  }

  public String getTemplateName() {
    return templateName;
  }

  public void setTemplateName(String templateName) {
    this.templateName = templateName;
  }

  public String getTemplateKind() {
    return templateKind;
  }

  public void setTemplateKind(String templateKind) {
    this.templateKind = templateKind;
  }

  public List<TemplateExerciseRequest> getExercises() {
    return exercises;
  }

  public void setExercises(List<TemplateExerciseRequest> exercises) {
    this.exercises = exercises;
  }
}
