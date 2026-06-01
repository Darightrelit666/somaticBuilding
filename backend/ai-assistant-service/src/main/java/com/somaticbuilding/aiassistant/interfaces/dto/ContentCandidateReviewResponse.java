package com.somaticbuilding.aiassistant.interfaces.dto;

import com.fasterxml.jackson.annotation.JsonAlias;

public class ContentCandidateReviewResponse {
  @JsonAlias("job_id")
  private Long jobId;
  @JsonAlias("updated_count")
  private Integer updatedCount;
  private String status;

  public Long getJobId() {
    return jobId;
  }

  public void setJobId(Long jobId) {
    this.jobId = jobId;
  }

  public Integer getUpdatedCount() {
    return updatedCount;
  }

  public void setUpdatedCount(Integer updatedCount) {
    this.updatedCount = updatedCount;
  }

  public String getStatus() {
    return status;
  }

  public void setStatus(String status) {
    this.status = status;
  }
}

