package com.somaticbuilding.posture.interfaces.dto;

public class PostureJointStateResponse {
  private String jointName;
  private Integer status;
  private String note;

  public String getJointName() {
    return jointName;
  }

  public void setJointName(String jointName) {
    this.jointName = jointName;
  }

  public Integer getStatus() {
    return status;
  }

  public void setStatus(Integer status) {
    this.status = status;
  }

  public String getNote() {
    return note;
  }

  public void setNote(String note) {
    this.note = note;
  }
}
