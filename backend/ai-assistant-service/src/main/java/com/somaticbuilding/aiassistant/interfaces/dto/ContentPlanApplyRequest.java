package com.somaticbuilding.aiassistant.interfaces.dto;

import com.fasterxml.jackson.annotation.JsonAlias;

public class ContentPlanApplyRequest {
  @JsonAlias("apply_target")
  private String applyTarget;
  @JsonAlias("save_template")
  private Boolean saveTemplate;

  public String getApplyTarget() {
    return applyTarget;
  }

  public void setApplyTarget(String applyTarget) {
    this.applyTarget = applyTarget;
  }

  public Boolean getSaveTemplate() {
    return saveTemplate;
  }

  public void setSaveTemplate(Boolean saveTemplate) {
    this.saveTemplate = saveTemplate;
  }
}

