package com.somaticbuilding.auth.application;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.somaticbuilding.auth.config.OauthProperties;
import com.somaticbuilding.auth.domain.UserAccount;
import com.somaticbuilding.auth.domain.UserOauth;
import com.somaticbuilding.auth.infrastructure.mapper.UserAccountMapper;
import com.somaticbuilding.auth.infrastructure.mapper.UserOauthMapper;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.reactive.function.client.WebClient;

import java.time.LocalDateTime;
import java.util.Map;
import java.util.UUID;

@Service
public class AuthAppService {
  private final UserAccountMapper userAccountMapper;
  private final UserOauthMapper userOauthMapper;
  private final OauthProperties oauthProperties;
  private final BCryptPasswordEncoder passwordEncoder = new BCryptPasswordEncoder();
  private final WebClient webClient = WebClient.create();

  public AuthAppService(UserAccountMapper userAccountMapper, UserOauthMapper userOauthMapper, OauthProperties oauthProperties) {
    this.userAccountMapper = userAccountMapper;
    this.userOauthMapper = userOauthMapper;
    this.oauthProperties = oauthProperties;
  }

  public String register(String email, String phone, String password) {
    if ((email == null || email.isBlank()) && (phone == null || phone.isBlank())) {
      throw new IllegalArgumentException("Email or phone is required.");
    }
    if (email != null && existsByEmail(email)) {
      throw new IllegalArgumentException("Email already exists.");
    }
    if (phone != null && existsByPhone(phone)) {
      throw new IllegalArgumentException("Phone already exists.");
    }
    UserAccount user = new UserAccount();
    user.setEmail(email);
    user.setPhone(phone);
    user.setPasswordHash(passwordEncoder.encode(password));
    user.setStatus(1);
    user.setIsDeleted(0);
    user.setCreateTime(LocalDateTime.now());
    user.setUpdateTime(LocalDateTime.now());
    userAccountMapper.insert(user);
    return issueToken();
  }

  public String login(String account, String password) {
    UserAccount user = findByAccount(account);
    if (user == null) {
      throw new IllegalArgumentException("Account not found.");
    }
    if (!passwordEncoder.matches(password, user.getPasswordHash())) {
      throw new IllegalArgumentException("Invalid password.");
    }
    return issueToken();
  }

  public String oauthLogin(String provider, String code, String redirectUri) {
    if ("google".equalsIgnoreCase(provider)) {
      return googleLogin(code, redirectUri);
    }
    if ("wechat".equalsIgnoreCase(provider)) {
      return wechatLogin(code, redirectUri);
    }
    throw new IllegalArgumentException("Unsupported provider.");
  }

  private UserAccount findByAccount(String account) {
    return userAccountMapper.selectOne(
      new LambdaQueryWrapper<UserAccount>()
        .eq(UserAccount::getIsDeleted, 0)
        .and(wrapper ->
          wrapper.eq(UserAccount::getEmail, account)
            .or()
            .eq(UserAccount::getPhone, account)
        )
    );
  }

  private boolean existsByEmail(String email) {
    return userAccountMapper.selectCount(
      new LambdaQueryWrapper<UserAccount>()
        .eq(UserAccount::getEmail, email)
        .eq(UserAccount::getIsDeleted, 0)
    ) > 0;
  }

  private boolean existsByPhone(String phone) {
    return userAccountMapper.selectCount(
      new LambdaQueryWrapper<UserAccount>()
        .eq(UserAccount::getPhone, phone)
        .eq(UserAccount::getIsDeleted, 0)
    ) > 0;
  }

  private String issueToken() {
    return UUID.randomUUID().toString().replace("-", "");
  }

  private String googleLogin(String code, String redirectUri) {
    OauthProperties.Google google = oauthProperties.getGoogle();
    if (google.getClientId() == null || google.getClientId().isBlank()) {
      throw new IllegalArgumentException("Google OAuth not configured.");
    }
    MultiValueMap<String, String> form = new LinkedMultiValueMap<>();
    form.add("client_id", google.getClientId());
    form.add("client_secret", google.getClientSecret());
    form.add("code", code);
    form.add("grant_type", "authorization_code");
    form.add("redirect_uri", redirectUri);

    Map tokenResp =
      webClient.post()
        .uri(google.getTokenUri())
        .headers(h -> h.set("Content-Type", "application/x-www-form-urlencoded"))
        .body(org.springframework.web.reactive.function.BodyInserters.fromFormData(form))
        .retrieve()
        .bodyToMono(Map.class)
        .block();

    if (tokenResp == null || tokenResp.get("access_token") == null) {
      throw new IllegalArgumentException("Google token exchange failed.");
    }
    String accessToken = String.valueOf(tokenResp.get("access_token"));

    Map userInfo =
      webClient.get()
        .uri(google.getUserinfoUri())
        .headers(h -> h.setBearerAuth(accessToken))
        .retrieve()
        .bodyToMono(Map.class)
        .block();

    if (userInfo == null) {
      throw new IllegalArgumentException("Google user info fetch failed.");
    }
    String sub = String.valueOf(userInfo.get("sub"));
    String email = userInfo.get("email") == null ? null : String.valueOf(userInfo.get("email"));
    return bindOauthUser("google", sub, null, email);
  }

  private String wechatLogin(String code, String redirectUri) {
    OauthProperties.Wechat wechat = oauthProperties.getWechat();
    if (wechat.getAppId() == null || wechat.getAppId().isBlank()) {
      throw new IllegalArgumentException("WeChat OAuth not configured.");
    }
    String tokenUrl =
      wechat.getTokenUri()
        + "?appid=" + wechat.getAppId()
        + "&secret=" + wechat.getAppSecret()
        + "&code=" + code
        + "&grant_type=authorization_code";

    Map tokenResp =
      webClient.get()
        .uri(tokenUrl)
        .retrieve()
        .bodyToMono(Map.class)
        .block();

    if (tokenResp == null || tokenResp.get("access_token") == null) {
      throw new IllegalArgumentException("WeChat token exchange failed.");
    }
    String accessToken = String.valueOf(tokenResp.get("access_token"));
    String openId = String.valueOf(tokenResp.get("openid"));
    String unionId = tokenResp.get("unionid") == null ? null : String.valueOf(tokenResp.get("unionid"));

    String userInfoUrl =
      wechat.getUserinfoUri()
        + "?access_token=" + accessToken
        + "&openid=" + openId
        + "&lang=zh_CN";

    Map userInfo =
      webClient.get()
        .uri(userInfoUrl)
        .retrieve()
        .bodyToMono(Map.class)
        .block();

    if (userInfo == null) {
      throw new IllegalArgumentException("WeChat user info fetch failed.");
    }
    return bindOauthUser("wechat", openId, unionId, null);
  }

  private String bindOauthUser(String provider, String openId, String unionId, String email) {
    UserOauth existing =
      userOauthMapper.selectOne(
        new LambdaQueryWrapper<UserOauth>()
          .eq(UserOauth::getProvider, provider)
          .eq(UserOauth::getOpenId, openId)
          .eq(UserOauth::getIsDeleted, 0)
      );

    if (existing != null) {
      return issueToken();
    }

    UserAccount user = new UserAccount();
    user.setEmail(email);
    user.setStatus(1);
    user.setIsDeleted(0);
    user.setCreateTime(LocalDateTime.now());
    user.setUpdateTime(LocalDateTime.now());
    userAccountMapper.insert(user);

    UserOauth bind = new UserOauth();
    bind.setUserId(user.getId());
    bind.setProvider(provider);
    bind.setOpenId(openId);
    bind.setUnionId(unionId);
    bind.setStatus(1);
    bind.setIsDeleted(0);
    bind.setCreateTime(LocalDateTime.now());
    bind.setUpdateTime(LocalDateTime.now());
    userOauthMapper.insert(bind);

    return issueToken();
  }
}
