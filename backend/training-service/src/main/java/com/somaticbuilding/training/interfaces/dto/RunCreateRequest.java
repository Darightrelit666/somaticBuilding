package com.somaticbuilding.training.interfaces.dto;

import jakarta.validation.constraints.NotNull;

public class RunCreateRequest {
  @NotNull
  private Long sessionId;
  @NotNull
  private Long userId;

  public Long getSessionId() {
    return sessionId;
  }

  public void setSessionId(Long sessionId) {
    this.sessionId = sessionId;
  }

  public Long getUserId() {
    return userId;
  }

  public void setUserId(Long userId) {
    this.userId = userId;
  }
}
