package com.somaticbuilding.aiassistant.interfaces.dto;

import com.fasterxml.jackson.annotation.JsonAlias;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;

import java.util.List;

public class ContentCandidateReviewRequest {
  @NotEmpty
  private List<@Valid UpdateItem> updates;

  public List<UpdateItem> getUpdates() {
    return updates;
  }

  public void setUpdates(List<UpdateItem> updates) {
    this.updates = updates;
  }

  public static class UpdateItem {
    @NotNull
    @JsonAlias("candidate_id")
    private Long candidateId;
    @NotBlank
    private String action;
    @JsonAlias("mapped_exercise_id")
    private Long mappedExerciseId;
    private String notes;

    public Long getCandidateId() {
      return candidateId;
    }

    public void setCandidateId(Long candidateId) {
      this.candidateId = candidateId;
    }

    public String getAction() {
      return action;
    }

    public void setAction(String action) {
      this.action = action;
    }

    public Long getMappedExerciseId() {
      return mappedExerciseId;
    }

    public void setMappedExerciseId(Long mappedExerciseId) {
      this.mappedExerciseId = mappedExerciseId;
    }

    public String getNotes() {
      return notes;
    }

    public void setNotes(String notes) {
      this.notes = notes;
    }
  }
}

