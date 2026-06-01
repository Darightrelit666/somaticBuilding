package com.somaticbuilding.aiassistant.domain;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@TableName("content_exercise_mapping")
public class ContentExerciseMapping {
  @TableId(type = IdType.AUTO)
  private Long id;
  private Long jobId;
  private Long candidateId;
  private Long exerciseId;
  private BigDecimal matchScore;
  private String mappingSource;
  private Integer finalSelected;
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

  public Long getCandidateId() {
    return candidateId;
  }

  public void setCandidateId(Long candidateId) {
    this.candidateId = candidateId;
  }

  public Long getExerciseId() {
    return exerciseId;
  }

  public void setExerciseId(Long exerciseId) {
    this.exerciseId = exerciseId;
  }

  public BigDecimal getMatchScore() {
    return matchScore;
  }

  public void setMatchScore(BigDecimal matchScore) {
    this.matchScore = matchScore;
  }

  public String getMappingSource() {
    return mappingSource;
  }

  public void setMappingSource(String mappingSource) {
    this.mappingSource = mappingSource;
  }

  public Integer getFinalSelected() {
    return finalSelected;
  }

  public void setFinalSelected(Integer finalSelected) {
    this.finalSelected = finalSelected;
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

