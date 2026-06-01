package com.somaticbuilding.workout.interfaces.dto;

import jakarta.validation.constraints.NotNull;

public class TemplateExerciseRequest {
  @NotNull
  private Long exerciseId;
  private Integer sets;
  private Integer reps;
  private Integer restSeconds;
  private Integer timeSeconds;
  private Integer rounds;
  private Integer orderIndex;

  public Long getExerciseId() {
    return exerciseId;
  }

  public void setExerciseId(Long exerciseId) {
    this.exerciseId = exerciseId;
  }

  public Integer getSets() {
    return sets;
  }

  public void setSets(Integer sets) {
    this.sets = sets;
  }

  public Integer getReps() {
    return reps;
  }

  public void setReps(Integer reps) {
    this.reps = reps;
  }

  public Integer getRestSeconds() {
    return restSeconds;
  }

  public void setRestSeconds(Integer restSeconds) {
    this.restSeconds = restSeconds;
  }

  public Integer getTimeSeconds() {
    return timeSeconds;
  }

  public void setTimeSeconds(Integer timeSeconds) {
    this.timeSeconds = timeSeconds;
  }

  public Integer getRounds() {
    return rounds;
  }

  public void setRounds(Integer rounds) {
    this.rounds = rounds;
  }

  public Integer getOrderIndex() {
    return orderIndex;
  }

  public void setOrderIndex(Integer orderIndex) {
    this.orderIndex = orderIndex;
  }
}
