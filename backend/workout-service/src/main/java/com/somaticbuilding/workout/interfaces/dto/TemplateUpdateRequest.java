package com.somaticbuilding.workout.interfaces.dto;

import java.util.List;

public class TemplateUpdateRequest {
  private String templateName;
  private String templateKind;
  private List<TemplateExerciseRequest> exercises;

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
