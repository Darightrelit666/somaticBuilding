package com.somaticbuilding.exercise.domain;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;

import java.time.LocalDateTime;

@TableName("exercise_media")
public class ExerciseMedia {
  @TableId(type = IdType.AUTO)
  private Long id;
  private Long exerciseId;
  private String mediaType;
  private String url;
  private Integer coverFlag;
  private LocalDateTime createTime;
  private LocalDateTime updateTime;
  private Integer isDeleted;

  public Long getId() {
    return id;
  }

  public void setId(Long id) {
    this.id = id;
  }

  public Long getExerciseId() {
    return exerciseId;
  }

  public void setExerciseId(Long exerciseId) {
    this.exerciseId = exerciseId;
  }

  public String getMediaType() {
    return mediaType;
  }

  public void setMediaType(String mediaType) {
    this.mediaType = mediaType;
  }

  public String getUrl() {
    return url;
  }

  public void setUrl(String url) {
    this.url = url;
  }

  public Integer getCoverFlag() {
    return coverFlag;
  }

  public void setCoverFlag(Integer coverFlag) {
    this.coverFlag = coverFlag;
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
