package com.somaticbuilding.training.interfaces.dto;

import jakarta.validation.constraints.NotNull;

public class RunUpdateRequest {
  @NotNull
  private Integer status;

  public Integer getStatus() {
    return status;
  }

  public void setStatus(Integer status) {
    this.status = status;
  }
}
