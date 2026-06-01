package com.somaticbuilding.aiassistant.interfaces.dto;

import com.fasterxml.jackson.annotation.JsonAlias;
import jakarta.validation.constraints.NotNull;

public class ContentPlanDirectApplyRequest {
  @NotNull
  @JsonAlias("user_id")
  private Long userId;

  @JsonAlias("plan_type")
  private String planType;

  private String style;

  private String title;

  @NotNull
  private Object structure;

  @JsonAlias("apply_target")
  private String applyTarget;

  @JsonAlias("save_template")
  private Boolean saveTemplate;

  public Long getUserId() {
    return userId;
  }

  public void setUserId(Long userId) {
    this.userId = userId;
  }

  public String getPlanType() {
    return planType;
  }

  public void setPlanType(String planType) {
    this.planType = planType;
  }

  public String getStyle() {
    return style;
  }

  public void setStyle(String style) {
    this.style = style;
  }

  public String getTitle() {
    return title;
  }

  public void setTitle(String title) {
    this.title = title;
  }

  public Object getStructure() {
    return structure;
  }

  public void setStructure(Object structure) {
    this.structure = structure;
  }

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

