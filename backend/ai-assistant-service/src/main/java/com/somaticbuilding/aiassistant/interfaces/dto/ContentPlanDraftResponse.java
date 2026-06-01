package com.somaticbuilding.aiassistant.interfaces.dto;

import com.fasterxml.jackson.annotation.JsonAlias;

public class ContentPlanDraftResponse {
  @JsonAlias("plan_id")
  private Long planId;
  @JsonAlias("plan_type")
  private String planType;
  @JsonAlias("option_index")
  private Integer optionIndex;
  private String style;
  private String title;
  private String summary;
  @JsonAlias("status_label")
  private String statusLabel;
  private Object structure;

  public Long getPlanId() {
    return planId;
  }

  public void setPlanId(Long planId) {
    this.planId = planId;
  }

  public String getPlanType() {
    return planType;
  }

  public void setPlanType(String planType) {
    this.planType = planType;
  }

  public Integer getOptionIndex() {
    return optionIndex;
  }

  public void setOptionIndex(Integer optionIndex) {
    this.optionIndex = optionIndex;
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

  public String getSummary() {
    return summary;
  }

  public void setSummary(String summary) {
    this.summary = summary;
  }

  public String getStatusLabel() {
    return statusLabel;
  }

  public void setStatusLabel(String statusLabel) {
    this.statusLabel = statusLabel;
  }

  public Object getStructure() {
    return structure;
  }

  public void setStructure(Object structure) {
    this.structure = structure;
  }
}

