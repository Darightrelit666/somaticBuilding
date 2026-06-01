package com.somaticbuilding.aiassistant.interfaces.dto;

import com.fasterxml.jackson.annotation.JsonAlias;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;

public class ContentCandidateResponse {
  @JsonAlias("candidate_id")
  private Long candidateId;
  @JsonAlias("raw_label")
  private String rawLabel;
  @JsonAlias("normalized_label")
  private String normalizedLabel;
  @JsonAlias("start_sec")
  private BigDecimal startSec;
  @JsonAlias("end_sec")
  private BigDecimal endSec;
  private BigDecimal confidence;
  @JsonAlias("review_state")
  private String reviewState;
  private String notes;
  @JsonAlias("mapped_exercise_id")
  private Long mappedExerciseId;
  @JsonAlias("mapped_exercise_name")
  private String mappedExerciseName;
  @JsonAlias("match_score")
  private BigDecimal matchScore;
  @JsonAlias("final_selected")
  private Integer finalSelected;
  @JsonAlias("alternative_exercises")
  private List<AlternativeExerciseOption> alternativeExercises = new ArrayList<>();

  public Long getCandidateId() {
    return candidateId;
  }

  public void setCandidateId(Long candidateId) {
    this.candidateId = candidateId;
  }

  public String getRawLabel() {
    return rawLabel;
  }

  public void setRawLabel(String rawLabel) {
    this.rawLabel = rawLabel;
  }

  public String getNormalizedLabel() {
    return normalizedLabel;
  }

  public void setNormalizedLabel(String normalizedLabel) {
    this.normalizedLabel = normalizedLabel;
  }

  public BigDecimal getStartSec() {
    return startSec;
  }

  public void setStartSec(BigDecimal startSec) {
    this.startSec = startSec;
  }

  public BigDecimal getEndSec() {
    return endSec;
  }

  public void setEndSec(BigDecimal endSec) {
    this.endSec = endSec;
  }

  public BigDecimal getConfidence() {
    return confidence;
  }

  public void setConfidence(BigDecimal confidence) {
    this.confidence = confidence;
  }

  public String getReviewState() {
    return reviewState;
  }

  public void setReviewState(String reviewState) {
    this.reviewState = reviewState;
  }

  public String getNotes() {
    return notes;
  }

  public void setNotes(String notes) {
    this.notes = notes;
  }

  public Long getMappedExerciseId() {
    return mappedExerciseId;
  }

  public void setMappedExerciseId(Long mappedExerciseId) {
    this.mappedExerciseId = mappedExerciseId;
  }

  public String getMappedExerciseName() {
    return mappedExerciseName;
  }

  public void setMappedExerciseName(String mappedExerciseName) {
    this.mappedExerciseName = mappedExerciseName;
  }

  public BigDecimal getMatchScore() {
    return matchScore;
  }

  public void setMatchScore(BigDecimal matchScore) {
    this.matchScore = matchScore;
  }

  public Integer getFinalSelected() {
    return finalSelected;
  }

  public void setFinalSelected(Integer finalSelected) {
    this.finalSelected = finalSelected;
  }

  public List<AlternativeExerciseOption> getAlternativeExercises() {
    return alternativeExercises;
  }

  public void setAlternativeExercises(List<AlternativeExerciseOption> alternativeExercises) {
    this.alternativeExercises = alternativeExercises == null ? new ArrayList<>() : alternativeExercises;
  }

  public static class AlternativeExerciseOption {
    @JsonAlias("exercise_id")
    private Long exerciseId;
    @JsonAlias("exercise_name")
    private String exerciseName;
    @JsonAlias("match_score")
    private BigDecimal matchScore;
    @JsonAlias("final_selected")
    private Integer finalSelected;
    @JsonAlias("mapping_source")
    private String mappingSource;

    public Long getExerciseId() {
      return exerciseId;
    }

    public void setExerciseId(Long exerciseId) {
      this.exerciseId = exerciseId;
    }

    public String getExerciseName() {
      return exerciseName;
    }

    public void setExerciseName(String exerciseName) {
      this.exerciseName = exerciseName;
    }

    public BigDecimal getMatchScore() {
      return matchScore;
    }

    public void setMatchScore(BigDecimal matchScore) {
      this.matchScore = matchScore;
    }

    public Integer getFinalSelected() {
      return finalSelected;
    }

    public void setFinalSelected(Integer finalSelected) {
      this.finalSelected = finalSelected;
    }

    public String getMappingSource() {
      return mappingSource;
    }

    public void setMappingSource(String mappingSource) {
      this.mappingSource = mappingSource;
    }
  }
}
