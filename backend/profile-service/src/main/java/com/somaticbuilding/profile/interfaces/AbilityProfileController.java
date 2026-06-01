package com.somaticbuilding.profile.interfaces;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.somaticbuilding.common.core.ApiResponse;
import com.somaticbuilding.common.core.ErrorCode;
import com.somaticbuilding.profile.application.AbilityProfileService;
import com.somaticbuilding.profile.domain.AbilityHistory;
import com.somaticbuilding.profile.domain.AbilityProfile;
import com.somaticbuilding.profile.interfaces.dto.AbilityHistoryResponse;
import com.somaticbuilding.profile.interfaces.dto.AbilityProfileRequest;
import com.somaticbuilding.profile.interfaces.dto.AbilityProfileResponse;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/ability")
public class AbilityProfileController {
  private final AbilityProfileService abilityProfileService;
  private final ObjectMapper objectMapper = new ObjectMapper();

  public AbilityProfileController(AbilityProfileService abilityProfileService) {
    this.abilityProfileService = abilityProfileService;
  }

  @GetMapping("/profile/latest")
  public ApiResponse<AbilityProfileResponse> latest(@RequestParam("user_id") Long userId) {
    AbilityProfile profile = abilityProfileService.latestProfile(userId);
    if (profile == null) {
      return ApiResponse.failure(ErrorCode.PARAM_ERROR.getCode(), "Profile not found.");
    }
    AbilityProfileResponse response = new AbilityProfileResponse();
    response.setStrength(profile.getStrength());
    response.setPower(profile.getPower());
    response.setEndurance(profile.getEndurance());
    response.setMobility(profile.getMobility());
    response.setStability(profile.getStability());
    response.setSpeed(profile.getSpeed());
    return ApiResponse.success(response);
  }

  @PostMapping("/profile")
  public ApiResponse<Map<String, Object>> createProfile(@Valid @RequestBody AbilityProfileRequest request) {
    AbilityProfile profile = new AbilityProfile();
    profile.setUserId(request.getUserId());
    profile.setStrength(request.getStrength());
    profile.setPower(request.getPower());
    profile.setEndurance(request.getEndurance());
    profile.setMobility(request.getMobility());
    profile.setStability(request.getStability());
    profile.setSpeed(request.getSpeed());
    AbilityProfile saved = abilityProfileService.createProfile(profile);
    return ApiResponse.success(Map.of("id", saved.getId()));
  }

  @GetMapping("/history")
  public ApiResponse<List<AbilityHistoryResponse>> history(@RequestParam("user_id") Long userId) {
    List<AbilityHistory> histories = abilityProfileService.listHistoryByUser(userId);
    List<AbilityHistoryResponse> responses = new ArrayList<>();
    for (AbilityHistory history : histories) {
      AbilityHistoryResponse response = new AbilityHistoryResponse();
      response.setRecordTime(history.getRecordTime());
      Map<String, Object> payload = parseDelta(history.getDeltaJson());
      response.setStrength(asInt(payload.get("strength")));
      response.setPower(asInt(payload.get("power")));
      response.setEndurance(asInt(payload.get("endurance")));
      response.setMobility(asInt(payload.get("mobility")));
      response.setStability(asInt(payload.get("stability")));
      response.setSpeed(asInt(payload.get("speed")));
      responses.add(response);
    }
    return ApiResponse.success(responses);
  }

  private Map<String, Object> parseDelta(String json) {
    if (json == null || json.isBlank()) {
      return Map.of();
    }
    try {
      return objectMapper.readValue(json, new TypeReference<Map<String, Object>>() {});
    } catch (IOException ex) {
      return Map.of();
    }
  }

  private Integer asInt(Object value) {
    if (value == null) {
      return null;
    }
    if (value instanceof Number number) {
      return number.intValue();
    }
    try {
      return Integer.parseInt(value.toString());
    } catch (NumberFormatException ex) {
      return null;
    }
  }
}
