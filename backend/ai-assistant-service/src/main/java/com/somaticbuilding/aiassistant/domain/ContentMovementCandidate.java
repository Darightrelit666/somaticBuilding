package com.somaticbuilding.aiassistant.domain;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@TableName("content_movement_candidate")
public class ContentMovementCandidate {
  @TableId(type = IdType.AUTO)
  private Long id;
  private Long jobId;
  private String rawLabel;
  private String normalizedLabel;
  private BigDecimal startSec;
  private BigDecimal endSec;
  private BigDecimal confidence;
  private String notes;
  private String reviewState;
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

  public Long getJobId() {
    return jobId;
  }

  public void setJobId(Long jobId) {
    this.jobId = jobId;
  }

  public String getRawLabel() {
    return rawLabel;
  }

  public void setRawLabel(String rawLabel) {
    this.rawLabel = rawLabel;
  }

  public String getNormalizedLabel() {
    return normalizedLabel;
  }

  public void setNormalizedLabel(String normalizedLabel) {
    this.normalizedLabel = normalizedLabel;
  }

  public BigDecimal getStartSec() {
    return startSec;
  }

  public void setStartSec(BigDecimal startSec) {
    this.startSec = startSec;
  }

  public BigDecimal getEndSec() {
    return endSec;
  }

  public void setEndSec(BigDecimal endSec) {
    this.endSec = endSec;
  }

  public BigDecimal getConfidence() {
    return confidence;
  }

  public void setConfidence(BigDecimal confidence) {
    this.confidence = confidence;
  }

  public String getNotes() {
    return notes;
  }

  public void setNotes(String notes) {
    this.notes = notes;
  }

  public String getReviewState() {
    return reviewState;
  }

  public void setReviewState(String reviewState) {
    this.reviewState = reviewState;
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

