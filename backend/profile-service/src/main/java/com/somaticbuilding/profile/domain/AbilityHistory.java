package com.somaticbuilding.profile.domain;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;

import java.time.LocalDateTime;

@TableName("ability_history")
public class AbilityHistory {
  @TableId(type = IdType.AUTO)
  private Long id;
  private Long profileId;
  private LocalDateTime recordTime;
  private String deltaJson;
  private String note;
  private LocalDateTime createTime;
  private LocalDateTime updateTime;
  private Integer isDeleted;

  public Long getId() {
    return id;
  }

  public void setId(Long id) {
    this.id = id;
  }

  public Long getProfileId() {
    return profileId;
  }

  public void setProfileId(Long profileId) {
    this.profileId = profileId;
  }

  public LocalDateTime getRecordTime() {
    return recordTime;
  }

  public void setRecordTime(LocalDateTime recordTime) {
    this.recordTime = recordTime;
  }

  public String getDeltaJson() {
    return deltaJson;
  }

  public void setDeltaJson(String deltaJson) {
    this.deltaJson = deltaJson;
  }

  public String getNote() {
    return note;
  }

  public void setNote(String note) {
    this.note = note;
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
