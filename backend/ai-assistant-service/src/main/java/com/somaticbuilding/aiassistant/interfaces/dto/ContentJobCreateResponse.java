package com.somaticbuilding.aiassistant.interfaces.dto;

import com.fasterxml.jackson.annotation.JsonAlias;

import java.util.ArrayList;
import java.util.List;

public class ContentJobCreateResponse {
  @JsonAlias("job_id")
  private Long jobId;
  private String status;
  private String sourcePlatform;
  @JsonAlias("required_material")
  private List<String> requiredMaterial = new ArrayList<>();

  public Long getJobId() {
    return jobId;
  }

  public void setJobId(Long jobId) {
    this.jobId = jobId;
  }

  public String getStatus() {
    return status;
  }

  public void setStatus(String status) {
    this.status = status;
  }

  public String getSourcePlatform() {
    return sourcePlatform;
  }

  public void setSourcePlatform(String sourcePlatform) {
    this.sourcePlatform = sourcePlatform;
  }

  public List<String> getRequiredMaterial() {
    return requiredMaterial;
  }

  public void setRequiredMaterial(List<String> requiredMaterial) {
    this.requiredMaterial = requiredMaterial;
  }
}

