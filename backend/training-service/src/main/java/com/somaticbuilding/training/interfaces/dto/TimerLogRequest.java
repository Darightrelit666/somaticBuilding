package com.somaticbuilding.training.interfaces.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.time.LocalDateTime;

public class TimerLogRequest {
  @NotNull
  private Long runId;
  @NotBlank
  private String phaseType;
  @NotNull
  private Integer durationSeconds;
  private LocalDateTime startTime;
  private LocalDateTime endTime;

  public Long getRunId() {
    return runId;
  }

  public void setRunId(Long runId) {
    this.runId = runId;
  }

  public String getPhaseType() {
    return phaseType;
  }

  public void setPhaseType(String phaseType) {
    this.phaseType = phaseType;
  }

  public Integer getDurationSeconds() {
    return durationSeconds;
  }

  public void setDurationSeconds(Integer durationSeconds) {
    this.durationSeconds = durationSeconds;
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
