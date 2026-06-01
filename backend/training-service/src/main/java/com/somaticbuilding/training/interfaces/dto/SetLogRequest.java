package com.somaticbuilding.training.interfaces.dto;

import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;

public class SetLogRequest {
  @NotNull
  private Long runId;
  @NotNull
  private Long exerciseId;
  @NotNull
  private Integer setIndex;
  private Integer reps;
  private BigDecimal weightKg;
  private Integer durationSeconds;

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

  public Integer getSetIndex() {
    return setIndex;
  }

  public void setSetIndex(Integer setIndex) {
    this.setIndex = setIndex;
  }

  public Integer getReps() {
    return reps;
  }

  public void setReps(Integer reps) {
    this.reps = reps;
  }

  public BigDecimal getWeightKg() {
    return weightKg;
  }

  public void setWeightKg(BigDecimal weightKg) {
    this.weightKg = weightKg;
  }

  public Integer getDurationSeconds() {
    return durationSeconds;
  }

  public void setDurationSeconds(Integer durationSeconds) {
    this.durationSeconds = durationSeconds;
  }
}
