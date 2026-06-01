package com.somaticbuilding.aiassistant.interfaces.dto;

import com.fasterxml.jackson.annotation.JsonAlias;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public class GoalSynthesisRequest {
  @NotNull
  @JsonAlias("user_id")
  private Long userId;

  @NotBlank
  @JsonAlias("goal_input")
  private String goalInput;

  @JsonAlias("lifestyle_profile")
  private String lifestyleProfile;

  public Long getUserId() {
    return userId;
  }

  public void setUserId(Long userId) {
    this.userId = userId;
  }

  public String getGoalInput() {
    return goalInput;
  }

  public void setGoalInput(String goalInput) {
    this.goalInput = goalInput;
  }

  public String getLifestyleProfile() {
    return lifestyleProfile;
  }

  public void setLifestyleProfile(String lifestyleProfile) {
    this.lifestyleProfile = lifestyleProfile;
  }
}
