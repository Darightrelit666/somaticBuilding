package com.somaticbuilding.assessment.interfaces.dto;

import jakarta.validation.constraints.NotNull;

import java.util.List;

public class PostureSnapshotCreateRequest {
  @NotNull
  private Long sessionId;
  private String summary;
  private List<PostureJointStateRequest> joints;

  public Long getSessionId() {
    return sessionId;
  }

  public void setSessionId(Long sessionId) {
    this.sessionId = sessionId;
  }

  public String getSummary() {
    return summary;
  }

  public void setSummary(String summary) {
    this.summary = summary;
  }

  public List<PostureJointStateRequest> getJoints() {
    return joints;
  }

  public void setJoints(List<PostureJointStateRequest> joints) {
    this.joints = joints;
  }
}
