package com.somaticbuilding.assessment.domain;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;

import java.time.LocalDateTime;

@TableName("assessment_step")
public class AssessmentStep {
  @TableId(type = IdType.AUTO)
  private Long id;
  private Long sessionId;
  private String stepType;
  private Integer stepStatus;
  private LocalDateTime createTime;
  private LocalDateTime updateTime;
  private Integer isDeleted;

  public Long getId() {
    return id;
  }

  public void setId(Long id) {
    this.id = id;
  }

  public Long getSessionId() {
    return sessionId;
  }

  public void setSessionId(Long sessionId) {
    this.sessionId = sessionId;
  }

  public String getStepType() {
    return stepType;
  }

  public void setStepType(String stepType) {
    this.stepType = stepType;
  }

  public Integer getStepStatus() {
    return stepStatus;
  }

  public void setStepStatus(Integer stepStatus) {
    this.stepStatus = stepStatus;
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
