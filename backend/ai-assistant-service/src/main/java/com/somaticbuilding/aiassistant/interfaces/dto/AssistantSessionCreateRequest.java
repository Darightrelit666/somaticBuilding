package com.somaticbuilding.aiassistant.interfaces.dto;

import jakarta.validation.constraints.NotNull;

public class AssistantSessionCreateRequest {
  @NotNull
  private Long userId;
  private String title;

  public Long getUserId() {
    return userId;
  }

  public void setUserId(Long userId) {
    this.userId = userId;
  }

  public String getTitle() {
    return title;
  }

  public void setTitle(String title) {
    this.title = title;
  }
}
