package com.somaticbuilding.assessment.interfaces.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public class PostureJointStateRequest {
  @NotBlank
  private String jointName;
  @NotNull
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
