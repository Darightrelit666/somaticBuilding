package com.somaticbuilding.workout.interfaces.dto;

import java.util.List;

public class GroupResponse {
  private Long id;
  private String groupType;
  private Integer orderIndex;
  private List<ExerciseResponse> exercises;

  public Long getId() {
    return id;
  }

  public void setId(Long id) {
    this.id = id;
  }

  public String getGroupType() {
    return groupType;
  }

  public void setGroupType(String groupType) {
    this.groupType = groupType;
  }

  public Integer getOrderIndex() {
    return orderIndex;
  }

  public void setOrderIndex(Integer orderIndex) {
    this.orderIndex = orderIndex;
  }

  public List<ExerciseResponse> getExercises() {
    return exercises;
  }

  public void setExercises(List<ExerciseResponse> exercises) {
    this.exercises = exercises;
  }
}
