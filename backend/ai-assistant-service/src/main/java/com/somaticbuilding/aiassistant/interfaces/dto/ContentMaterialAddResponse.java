package com.somaticbuilding.aiassistant.interfaces.dto;

import com.fasterxml.jackson.annotation.JsonAlias;

public class ContentMaterialAddResponse {
  @JsonAlias("job_id")
  private Long jobId;
  @JsonAlias("added_count")
  private Integer addedCount;
  private String status;

  public Long getJobId() {
    return jobId;
  }

  public void setJobId(Long jobId) {
    this.jobId = jobId;
  }

  public Integer getAddedCount() {
    return addedCount;
  }

  public void setAddedCount(Integer addedCount) {
    this.addedCount = addedCount;
  }

  public String getStatus() {
    return status;
  }

  public void setStatus(String status) {
    this.status = status;
  }
}

