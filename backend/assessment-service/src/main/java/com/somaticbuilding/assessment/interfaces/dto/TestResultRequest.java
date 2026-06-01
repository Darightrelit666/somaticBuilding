package com.somaticbuilding.assessment.interfaces.dto;

import jakarta.validation.constraints.NotNull;

public class TestResultRequest {
  @NotNull
  private Long testId;
  @NotNull
  private Integer score;
  private String note;

  public Long getTestId() {
    return testId;
  }

  public void setTestId(Long testId) {
    this.testId = testId;
  }

  public Integer getScore() {
    return score;
  }

  public void setScore(Integer score) {
    this.score = score;
  }

  public String getNote() {
    return note;
  }

  public void setNote(String note) {
    this.note = note;
  }
}
