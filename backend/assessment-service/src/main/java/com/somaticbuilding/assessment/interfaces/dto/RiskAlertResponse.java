package com.somaticbuilding.assessment.interfaces.dto;

public class RiskAlertResponse {
  private String joint;
  private Integer severity;
  private String message;

  public String getJoint() {
    return joint;
  }

  public void setJoint(String joint) {
    this.joint = joint;
  }

  public Integer getSeverity() {
    return severity;
  }

  public void setSeverity(Integer severity) {
    this.severity = severity;
  }

  public String getMessage() {
    return message;
  }

  public void setMessage(String message) {
    this.message = message;
  }
}
