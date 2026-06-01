package com.somaticbuilding.assessment.interfaces.dto;

import java.util.List;

public class AssessmentSummaryResponse {
  private String summary;
  private List<JointMetricResponse> jointMetrics;
  private List<RiskAlertResponse> riskAlerts;

  public String getSummary() {
    return summary;
  }

  public void setSummary(String summary) {
    this.summary = summary;
  }

  public List<JointMetricResponse> getJointMetrics() {
    return jointMetrics;
  }

  public void setJointMetrics(List<JointMetricResponse> jointMetrics) {
    this.jointMetrics = jointMetrics;
  }

  public List<RiskAlertResponse> getRiskAlerts() {
    return riskAlerts;
  }

  public void setRiskAlerts(List<RiskAlertResponse> riskAlerts) {
    this.riskAlerts = riskAlerts;
  }
}
