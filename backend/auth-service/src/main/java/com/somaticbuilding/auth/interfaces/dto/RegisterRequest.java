package com.somaticbuilding.auth.interfaces.dto;

import jakarta.validation.constraints.NotBlank;

public class RegisterRequest {
  @NotBlank
  private String password;
  private String email;
  private String phone;

  public String getPassword() {
    return password;
  }

  public void setPassword(String password) {
    this.password = password;
  }

  public String getEmail() {
    return email;
  }

  public void setEmail(String email) {
    this.email = email;
  }

  public String getPhone() {
    return phone;
  }

  public void setPhone(String phone) {
    this.phone = phone;
  }
}
