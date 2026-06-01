package com.somaticbuilding.assessment.domain;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;

import java.time.LocalDateTime;

@TableName("joint_metric")
public class JointMetric {
  @TableId(type = IdType.AUTO)
  private Long id;
  private Long resultId;
  private String jointName;
  private Integer mobility;
  private Integer stability;
  private Integer motorControl;
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

  public Long getResultId() {
    return resultId;
  }

  public void setResultId(Long resultId) {
    this.resultId = resultId;
  }

  public String getJointName() {
    return jointName;
  }

  public void setJointName(String jointName) {
    this.jointName = jointName;
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

  public Integer getMotorControl() {
    return motorControl;
  }

  public void setMotorControl(Integer motorControl) {
    this.motorControl = motorControl;
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
