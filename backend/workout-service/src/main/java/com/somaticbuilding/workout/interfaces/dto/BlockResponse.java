package com.somaticbuilding.workout.interfaces.dto;

import java.util.List;

public class BlockResponse {
  private Long id;
  private String blockName;
  private Integer orderIndex;
  private List<GroupResponse> groups;

  public Long getId() {
    return id;
  }

  public void setId(Long id) {
    this.id = id;
  }

  public String getBlockName() {
    return blockName;
  }

  public void setBlockName(String blockName) {
    this.blockName = blockName;
  }

  public Integer getOrderIndex() {
    return orderIndex;
  }

  public void setOrderIndex(Integer orderIndex) {
    this.orderIndex = orderIndex;
  }

  public List<GroupResponse> getGroups() {
    return groups;
  }

  public void setGroups(List<GroupResponse> groups) {
    this.groups = groups;
  }
}
