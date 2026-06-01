package com.somaticbuilding.training.interfaces.dto;

import jakarta.validation.constraints.NotNull;

import java.time.LocalDateTime;

public class ExerciseLogRequest {
  @NotNull
  private Long runId;
  @NotNull
  private Long exerciseId;
  private LocalDateTime startTime;
  private LocalDateTime endTime;
  private String note;

  public Long getRunId() {
    return runId;
  }

  public void setRunId(Long runId) {
    this.runId = runId;
  }

  public Long getExerciseId() {
    return exerciseId;
  }

  public void setExerciseId(Long exerciseId) {
    this.exerciseId = exerciseId;
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

  public String getNote() {
    return note;
  }

  public void setNote(String note) {
    this.note = note;
  }
}
