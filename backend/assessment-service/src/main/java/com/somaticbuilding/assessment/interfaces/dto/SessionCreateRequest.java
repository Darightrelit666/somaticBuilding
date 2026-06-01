package com.somaticbuilding.assessment.interfaces.dto;

import jakarta.validation.constraints.NotNull;

public class SessionCreateRequest {
  @NotNull
  private Long userId;

  public Long getUserId() {
    return userId;
  }

  public void setUserId(Long userId) {
    this.userId = userId;
  }
}
