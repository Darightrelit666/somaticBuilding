package com.somaticbuilding.profile.domain;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;

import java.time.LocalDateTime;

@TableName("ability_profile")
public class AbilityProfile {
  @TableId(type = IdType.AUTO)
  private Long id;
  private Long userId;
  private Integer strength;
  private Integer power;
  private Integer endurance;
  private Integer mobility;
  private Integer stability;
  private Integer speed;
  private Integer status;
  private LocalDateTime createTime;
  private LocalDateTime updateTime;
  private Integer isDeleted;

  public Long getId() {
    return id;
  }

  public void setId(Long id) {
    this.id = id;
  }

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

  public Integer getStatus() {
    return status;
  }

  public void setStatus(Integer status) {
    this.status = status;
  }

  public LocalDateTime getCreateTime() {
    return createTime;
  }

  public void setCreateTime(LocalDateTime createTime) {
    this.createTime = createTime;
  }

  public LocalDateTime getUpdateTime() {
    return updateTime;
  }

  public void setUpdateTime(LocalDateTime updateTime) {
    this.updateTime = updateTime;
  }

  public Integer getIsDeleted() {
    return isDeleted;
  }

  public void setIsDeleted(Integer isDeleted) {
    this.isDeleted = isDeleted;
  }
}
