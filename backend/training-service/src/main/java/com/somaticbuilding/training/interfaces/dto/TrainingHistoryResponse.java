package com.somaticbuilding.training.interfaces.dto;

import java.time.LocalDateTime;

public class TrainingHistoryResponse {
  private Long runId;
  private Long sessionId;
  private LocalDateTime startTime;
  private LocalDateTime endTime;

  public Long getRunId() {
    return runId;
  }

  public void setRunId(Long runId) {
    this.runId = runId;
  }

  public Long getSessionId() {
    return sessionId;
  }

  public void setSessionId(Long sessionId) {
    this.sessionId = sessionId;
  }

  public LocalDateTime getStartTime() {
    return startTime;
  }

  public void setStartTime(LocalDateTime startTime) {
    this.startTime = startTime;
  }

  public LocalDateTime getEndTime() {
    return endTime;
  }

  public void setEndTime(LocalDateTime endTime) {
    this.endTime = endTime;
  }
}
