package com.somaticbuilding.aiassistant.interfaces.dto;

import java.time.LocalDateTime;

public class AssistantMessageResponse {
  private Long id;
  private String role;
  private String content;
  private LocalDateTime createTime;

  public Long getId() {
    return id;
  }

  public void setId(Long id) {
    this.id = id;
  }

  public String getRole() {
    return role;
  }

  public void setRole(String role) {
    this.role = role;
  }

  public String getContent() {
    return content;
  }

  public void setContent(String content) {
    this.content = content;
  }

  public LocalDateTime getCreateTime() {
    return createTime;
  }

  public void setCreateTime(LocalDateTime createTime) {
    this.createTime = createTime;
  }
}
