package com.somaticbuilding.auth.interfaces;

import com.somaticbuilding.auth.application.AuthAppService;
import com.somaticbuilding.auth.interfaces.dto.AuthResponse;
import com.somaticbuilding.auth.interfaces.dto.LoginRequest;
import com.somaticbuilding.auth.interfaces.dto.OauthLoginRequest;
import com.somaticbuilding.auth.interfaces.dto.RegisterRequest;
import com.somaticbuilding.common.core.ApiResponse;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/auth")
public class AuthController {
  private final AuthAppService authAppService;

  public AuthController(AuthAppService authAppService) {
    this.authAppService = authAppService;
  }

  @PostMapping("/register")
  public ApiResponse<AuthResponse> register(@Valid @RequestBody RegisterRequest request) {
    String token = authAppService.register(request.getEmail(), request.getPhone(), request.getPassword());
    return ApiResponse.success(new AuthResponse(token));
  }

  @PostMapping("/login")
  public ApiResponse<AuthResponse> login(@Valid @RequestBody LoginRequest request) {
    String token = authAppService.login(request.getAccount(), request.getPassword());
    return ApiResponse.success(new AuthResponse(token));
  }

  @PostMapping("/oauth/login")
  public ApiResponse<AuthResponse> oauthLogin(@Valid @RequestBody OauthLoginRequest request) {
    String token = authAppService.oauthLogin(request.getProvider(), request.getCode(), request.getRedirectUri());
    return ApiResponse.success(new AuthResponse(token));
  }
}
