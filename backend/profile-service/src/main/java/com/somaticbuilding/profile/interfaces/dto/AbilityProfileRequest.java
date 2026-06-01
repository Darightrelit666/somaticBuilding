package com.somaticbuilding.profile.interfaces.dto;

import jakarta.validation.constraints.NotNull;

public class AbilityProfileRequest {
  @NotNull
  private Long userId;
  private Integer strength;
  private Integer power;
  private Integer endurance;
  private Integer mobility;
  private Integer stability;
  private Integer speed;

  public Long getUserId() {
    return userId;
  }

  public void setUserId(Long userId) {
    this.userId = userId;
  }

  public Integer getStrength() {
    return strength;
  }

  public void setStrength(Integer strength) {
    this.strength = strength;
  }

  public Integer getPower() {
    return power;
  }

  public void setPower(Integer power) {
    this.power = power;
  }

  public Integer getEndurance() {
    return endurance;
  }

  public void setEndurance(Integer endurance) {
    this.endurance = endurance;
  }

  public Integer getMobility() {
    return mobility;
  }

  public void setMobility(Integer mobility) {
    this.mobility = mobility;
  }

  public Integer getStability() {
    return stability;
  }

  public void setStability(Integer stability) {
    this.stability = stability;
  }

  public Integer getSpeed() {
    return speed;
  }

  public void setSpeed(Integer speed) {
    this.speed = speed;
  }
}
