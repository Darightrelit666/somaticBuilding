package com.somaticbuilding.auth.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

@Component
@ConfigurationProperties(prefix = "auth.oauth")
public class OauthProperties {
  private Google google = new Google();
  private Wechat wechat = new Wechat();

  public Google getGoogle() {
    return google;
  }

  public void setGoogle(Google google) {
    this.google = google;
  }

  public Wechat getWechat() {
    return wechat;
  }

  public void setWechat(Wechat wechat) {
    this.wechat = wechat;
  }

  public static class Google {
    private String clientId;
    private String clientSecret;
    private String tokenUri;
    private String userinfoUri;

    public String getClientId() {
      return clientId;
    }

    public void setClientId(String clientId) {
      this.clientId = clientId;
    }

    public String getClientSecret() {
      return clientSecret;
    }

    public void setClientSecret(String clientSecret) {
      this.clientSecret = clientSecret;
    }

    public String getTokenUri() {
      return tokenUri;
    }

    public void setTokenUri(String tokenUri) {
      this.tokenUri = tokenUri;
    }

    public String getUserinfoUri() {
      return userinfoUri;
    }

    public void setUserinfoUri(String userinfoUri) {
      this.userinfoUri = userinfoUri;
    }
  }

  public static class Wechat {
    private String appId;
    private String appSecret;
    private String tokenUri;
    private String userinfoUri;

    public String getAppId() {
      return appId;
    }

    public void setAppId(String appId) {
      this.appId = appId;
    }

    public String getAppSecret() {
      return appSecret;
    }

    public void setAppSecret(String appSecret) {
      this.appSecret = appSecret;
    }

    public String getTokenUri() {
      return tokenUri;
    }

    public void setTokenUri(String tokenUri) {
      this.tokenUri = tokenUri;
    }

    public String getUserinfoUri() {
      return userinfoUri;
    }

    public void setUserinfoUri(String userinfoUri) {
      this.userinfoUri = userinfoUri;
    }
  }
}
