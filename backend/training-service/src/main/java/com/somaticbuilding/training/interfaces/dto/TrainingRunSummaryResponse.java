package com.somaticbuilding.training.interfaces.dto;

import java.math.BigDecimal;
import java.time.LocalDateTime;

public class TrainingRunSummaryResponse {
  private Long runId;
  private Long sessionId;
  private Long userId;
  private Integer runStatus;
  private LocalDateTime startTime;
  private LocalDateTime endTime;
  private Long durationSeconds;
  private Long setLogCount;
  private Long totalReps;
  private BigDecimal totalWeightKg;
  private Long totalSetDurationSeconds;
  private Long timerLogCount;
  private Long totalTimerDurationSeconds;
  private Long distinctExerciseCount;
  private Long skippedExerciseCount;

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

  public Long getUserId() {
    return userId;
  }

  public void setUserId(Long userId) {
    this.userId = userId;
  }

  public Integer getRunStatus() {
    return runStatus;
  }

  public void setRunStatus(Integer runStatus) {
    this.runStatus = runStatus;
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

  public Long getDurationSeconds() {
    return durationSeconds;
  }

  public void setDurationSeconds(Long durationSeconds) {
    this.durationSeconds = durationSeconds;
  }

  public Long getSetLogCount() {
    return setLogCount;
  }

  public void setSetLogCount(Long setLogCount) {
    this.setLogCount = setLogCount;
  }

  public Long getTotalReps() {
    return totalReps;
  }

  public void setTotalReps(Long totalReps) {
    this.totalReps = totalReps;
  }

  public BigDecimal getTotalWeightKg() {
    return totalWeightKg;
  }

  public void setTotalWeightKg(BigDecimal totalWeightKg) {
    this.totalWeightKg = totalWeightKg;
  }

  public Long getTotalSetDurationSeconds() {
    return totalSetDurationSeconds;
  }

  public void setTotalSetDurationSeconds(Long totalSetDurationSeconds) {
    this.totalSetDurationSeconds = totalSetDurationSeconds;
  }

  public Long getTimerLogCount() {
    return timerLogCount;
  }

  public void setTimerLogCount(Long timerLogCount) {
    this.timerLogCount = timerLogCount;
  }

  public Long getTotalTimerDurationSeconds() {
    return totalTimerDurationSeconds;
  }

  public void setTotalTimerDurationSeconds(Long totalTimerDurationSeconds) {
    this.totalTimerDurationSeconds = totalTimerDurationSeconds;
  }

  public Long getDistinctExerciseCount() {
    return distinctExerciseCount;
  }

  public void setDistinctExerciseCount(Long distinctExerciseCount) {
    this.distinctExerciseCount = distinctExerciseCount;
  }

  public Long getSkippedExerciseCount() {
    return skippedExerciseCount;
  }

  public void setSkippedExerciseCount(Long skippedExerciseCount) {
    this.skippedExerciseCount = skippedExerciseCount;
  }
}
