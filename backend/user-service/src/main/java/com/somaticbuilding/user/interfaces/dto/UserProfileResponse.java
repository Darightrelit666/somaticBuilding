package com.somaticbuilding.user.interfaces.dto;

import java.math.BigDecimal;

public class UserProfileResponse {
  private String displayName;
  private Integer gender;
  private Integer age;
  private Integer heightCm;
  private BigDecimal weightKg;
  private Integer trainingYears;
  private String lifestyleNote;

  public String getDisplayName() {
    return displayName;
  }

  public void setDisplayName(String displayName) {
    this.displayName = displayName;
  }

  public Integer getGender() {
    return gender;
  }

  public void setGender(Integer gender) {
    this.gender = gender;
  }

  public Integer getAge() {
    return age;
  }

  public void setAge(Integer age) {
    this.age = age;
  }

  public Integer getHeightCm() {
    return heightCm;
  }

  public void setHeightCm(Integer heightCm) {
    this.heightCm = heightCm;
  }

  public BigDecimal getWeightKg() {
    return weightKg;
  }

  public void setWeightKg(BigDecimal weightKg) {
    this.weightKg = weightKg;
  }

  public Integer getTrainingYears() {
    return trainingYears;
  }

  public void setTrainingYears(Integer trainingYears) {
    this.trainingYears = trainingYears;
  }

  public String getLifestyleNote() {
    return lifestyleNote;
  }

  public void setLifestyleNote(String lifestyleNote) {
    this.lifestyleNote = lifestyleNote;
  }
}
