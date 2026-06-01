package com.somaticbuilding.aiassistant.interfaces.dto;

import com.fasterxml.jackson.annotation.JsonAlias;

public class ContentPlanGenerateRequest {
  @JsonAlias("plan_type")
  private String planType;
  private Integer options;
  @JsonAlias("style_hint")
  private String styleHint;
  @JsonAlias("user_prompt")
  private String userPrompt;
  @JsonAlias("generation_mode")
  private String generationMode;

  public String getPlanType() {
    return planType;
  }

  public void setPlanType(String planType) {
    this.planType = planType;
  }

  public Integer getOptions() {
    return options;
  }

  public void setOptions(Integer options) {
    this.options = options;
  }

  public String getStyleHint() {
    return styleHint;
  }

  public void setStyleHint(String styleHint) {
    this.styleHint = styleHint;
  }

  public String getUserPrompt() {
    return userPrompt;
  }

  public void setUserPrompt(String userPrompt) {
    this.userPrompt = userPrompt;
  }

  public String getGenerationMode() {
    return generationMode;
  }

  public void setGenerationMode(String generationMode) {
    this.generationMode = generationMode;
  }
}
