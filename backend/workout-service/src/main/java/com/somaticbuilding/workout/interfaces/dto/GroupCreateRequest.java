package com.somaticbuilding.workout.interfaces.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public class GroupCreateRequest {
  @NotNull
  private Long blockId;
  @NotBlank
  private String groupType;
  @NotNull
  private Integer orderIndex;

  public Long getBlockId() {
    return blockId;
  }

  public void setBlockId(Long blockId) {
    this.blockId = blockId;
  }

  public String getGroupType() {
    return groupType;
  }

  public void setGroupType(String groupType) {
    this.groupType = groupType;
  }

  public Integer getOrderIndex() {
    return orderIndex;
  }

  public void setOrderIndex(Integer orderIndex) {
    this.orderIndex = orderIndex;
  }
}
