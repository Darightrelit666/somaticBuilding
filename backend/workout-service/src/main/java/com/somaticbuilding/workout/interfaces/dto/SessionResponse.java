package com.somaticbuilding.workout.interfaces.dto;

import java.util.List;

public class SessionResponse {
  private Long id;
  private String sessionName;
  private String trainingStyle;
  private List<BlockResponse> blocks;

  public Long getId() {
    return id;
  }

  public void setId(Long id) {
    this.id = id;
  }

  public String getSessionName() {
    return sessionName;
  }

  public void setSessionName(String sessionName) {
    this.sessionName = sessionName;
  }

  public String getTrainingStyle() {
    return trainingStyle;
  }

  public void setTrainingStyle(String trainingStyle) {
    this.trainingStyle = trainingStyle;
  }

  public List<BlockResponse> getBlocks() {
    return blocks;
  }

  public void setBlocks(List<BlockResponse> blocks) {
    this.blocks = blocks;
  }
}
