package com.somaticbuilding.aiassistant.interfaces.dto;

import com.fasterxml.jackson.annotation.JsonAlias;

public class ContentPlanApplyResponse {
  @JsonAlias("job_id")
  private Long jobId;
  @JsonAlias("plan_id")
  private Long planId;
  private String status;
  @JsonAlias("apply_target")
  private String applyTarget;
  @JsonAlias("session_id")
  private Long sessionId;
  @JsonAlias("template_id")
  private Long templateId;
  private String note;

  public Long getJobId() {
    return jobId;
  }

  public void setJobId(Long jobId) {
    this.jobId = jobId;
  }

  public Long getPlanId() {
    return planId;
  }

  public void setPlanId(Long planId) {
    this.planId = planId;
  }

  public String getStatus() {
    return status;
  }

  public void setStatus(String status) {
    this.status = status;
  }

  public String getApplyTarget() {
    return applyTarget;
  }

  public void setApplyTarget(String applyTarget) {
    this.applyTarget = applyTarget;
  }

  public Long getSessionId() {
    return sessionId;
  }

  public void setSessionId(Long sessionId) {
    this.sessionId = sessionId;
  }

  public Long getTemplateId() {
    return templateId;
  }

  public void setTemplateId(Long templateId) {
    this.templateId = templateId;
  }

  public String getNote() {
    return note;
  }

  public void setNote(String note) {
    this.note = note;
  }
}

