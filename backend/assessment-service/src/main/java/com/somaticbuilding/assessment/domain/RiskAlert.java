package com.somaticbuilding.assessment.domain;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;

import java.time.LocalDateTime;

@TableName("risk_alert")
public class RiskAlert {
  @TableId(type = IdType.AUTO)
  private Long id;
  private Long resultId;
  private String jointName;
  private Integer severity;
  private String message;
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

  public Integer getSeverity() {
    return severity;
  }

  public void setSeverity(Integer severity) {
    this.severity = severity;
  }

  public String getMessage() {
    return message;
  }

  public void setMessage(String message) {
    this.message = message;
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
