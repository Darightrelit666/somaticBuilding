package com.somaticbuilding.recommendation.interfaces.dto;

public class RecommendationResponse {
  private Long id;
  private String recType;
  private Long refId;
  private String reason;

  public Long getId() {
    return id;
  }

  public void setId(Long id) {
    this.id = id;
  }

  public String getRecType() {
    return recType;
  }

  public void setRecType(String recType) {
    this.recType = recType;
  }

  public Long getRefId() {
    return refId;
  }

  public void setRefId(Long refId) {
    this.refId = refId;
  }

  public String getReason() {
    return reason;
  }

  public void setReason(String reason) {
    this.reason = reason;
  }
}
