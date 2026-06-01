package com.somaticbuilding.auth.interfaces.dto;

import jakarta.validation.constraints.NotBlank;

public class OauthLoginRequest {
  @NotBlank
  private String provider;

  @NotBlank
  private String code;

  @NotBlank
  private String redirectUri;

  public String getProvider() {
    return provider;
  }

  public void setProvider(String provider) {
    this.provider = provider;
  }

  public String getCode() {
    return code;
  }

  public void setCode(String code) {
    this.code = code;
  }

  public String getRedirectUri() {
    return redirectUri;
  }

  public void setRedirectUri(String redirectUri) {
    this.redirectUri = redirectUri;
  }
}
