package com.somaticbuilding.assessment.interfaces.dto;

import java.time.LocalDateTime;
import java.util.List;

public class PostureSnapshotResponse {
  private Long id;
  private LocalDateTime snapshotTime;
  private String summary;
  private List<PostureJointStateResponse> joints;

  public Long getId() {
    return id;
  }

  public void setId(Long id) {
    this.id = id;
  }

  public LocalDateTime getSnapshotTime() {
    return snapshotTime;
  }

  public void setSnapshotTime(LocalDateTime snapshotTime) {
    this.snapshotTime = snapshotTime;
  }

  public String getSummary() {
    return summary;
  }

  public void setSummary(String summary) {
    this.summary = summary;
  }

  public List<PostureJointStateResponse> getJoints() {
    return joints;
  }

  public void setJoints(List<PostureJointStateResponse> joints) {
    this.joints = joints;
  }
}
