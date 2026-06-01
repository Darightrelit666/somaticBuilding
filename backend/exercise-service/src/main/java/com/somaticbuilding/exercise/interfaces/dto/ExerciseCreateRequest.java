package com.somaticbuilding.exercise.interfaces.dto;

public class ExerciseCreateRequest {
  private String name;

  private String primaryMuscle;

  private String equipment;

  private Integer difficulty;

  private String description;

  private String coverUrl;

  private String videoUrl;

  public String getName() {
    return name;
  }

  public void setName(String name) {
    this.name = name;
  }

  public String getPrimaryMuscle() {
    return primaryMuscle;
  }

  public void setPrimaryMuscle(String primaryMuscle) {
    this.primaryMuscle = primaryMuscle;
  }

  public String getEquipment() {
    return equipment;
  }

  public void setEquipment(String equipment) {
    this.equipment = equipment;
  }

  public Integer getDifficulty() {
    return difficulty;
  }

  public void setDifficulty(Integer difficulty) {
    this.difficulty = difficulty;
  }

  public String getDescription() {
    return description;
  }

  public void setDescription(String description) {
    this.description = description;
  }

  public String getCoverUrl() {
    return coverUrl;
  }

  public void setCoverUrl(String coverUrl) {
    this.coverUrl = coverUrl;
  }

  public String getVideoUrl() {
    return videoUrl;
  }

  public void setVideoUrl(String videoUrl) {
    this.videoUrl = videoUrl;
  }
}
