package com.somaticbuilding.user.interfaces.dto;

public class DisplayNameAvailabilityResponse {
  private Boolean available;
  private String displayName;

  public Boolean getAvailable() {
    return available;
  }

  public void setAvailable(Boolean available) {
    this.available = available;
  }

  public String getDisplayName() {
    return displayName;
  }

  public void setDisplayName(String displayName) {
    this.displayName = displayName;
  }
}
