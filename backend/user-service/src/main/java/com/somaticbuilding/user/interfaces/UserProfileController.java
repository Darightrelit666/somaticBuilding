package com.somaticbuilding.user.interfaces;

import com.somaticbuilding.common.core.ApiResponse;
import com.somaticbuilding.common.core.ErrorCode;
import com.somaticbuilding.user.application.UserProfileService;
import com.somaticbuilding.user.domain.UserProfile;
import com.somaticbuilding.user.interfaces.dto.DisplayNameAvailabilityResponse;
import com.somaticbuilding.user.interfaces.dto.UserProfileRequest;
import com.somaticbuilding.user.interfaces.dto.UserProfileResponse;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/user")
public class UserProfileController {
  private final UserProfileService userProfileService;

  public UserProfileController(UserProfileService userProfileService) {
    this.userProfileService = userProfileService;
  }

  @GetMapping("/profile")
  public ApiResponse<UserProfileResponse> getProfile(@RequestParam("user_id") Long userId) {
    UserProfile profile = userProfileService.getProfile(userId);
    if (profile == null) {
      return ApiResponse.failure(ErrorCode.PARAM_ERROR.getCode(), "Profile not found.");
    }
    UserProfileResponse response = new UserProfileResponse();
    response.setDisplayName(profile.getDisplayName());
    response.setGender(profile.getGender());
    response.setAge(profile.getAge());
    response.setHeightCm(profile.getHeightCm());
    response.setWeightKg(profile.getWeightKg());
    response.setTrainingYears(profile.getTrainingYears());
    response.setLifestyleNote(profile.getLifestyleNote());
    return ApiResponse.success(response);
  }

  @PutMapping("/profile")
  public ApiResponse<Void> updateProfile(@Valid @RequestBody UserProfileRequest request) {
    UserProfile profile = new UserProfile();
    profile.setDisplayName(request.getDisplayName());
    profile.setGender(request.getGender());
    profile.setAge(request.getAge());
    profile.setHeightCm(request.getHeightCm());
    profile.setWeightKg(request.getWeightKg());
    profile.setTrainingYears(request.getTrainingYears());
    profile.setLifestyleNote(request.getLifestyleNote());
    userProfileService.upsertProfile(request.getUserId(), profile);
    return ApiResponse.success(null);
  }

  @GetMapping("/profile/display-name/availability")
  public ApiResponse<DisplayNameAvailabilityResponse> checkDisplayNameAvailability(
    @RequestParam("display_name") String displayName,
    @RequestParam(value = "user_id", required = false) Long userId
  ) {
    boolean available = userProfileService.isDisplayNameAvailable(userId, displayName);
    DisplayNameAvailabilityResponse response = new DisplayNameAvailabilityResponse();
    response.setAvailable(available);
    response.setDisplayName(displayName == null ? "" : displayName.trim());
    return ApiResponse.success(response);
  }
}
