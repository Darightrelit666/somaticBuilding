package com.somaticbuilding.workout.interfaces.dto;

public class TemplateResponse {
  private Long id;
  private String templateName;
  private String templateKind;
  private String shareCode;

  public Long getId() {
    return id;
  }

  public void setId(Long id) {
    this.id = id;
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

  public String getShareCode() {
    return shareCode;
  }

  public void setShareCode(String shareCode) {
    this.shareCode = shareCode;
  }
}
