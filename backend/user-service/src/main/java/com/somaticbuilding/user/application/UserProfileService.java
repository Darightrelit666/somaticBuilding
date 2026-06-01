package com.somaticbuilding.user.application;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.somaticbuilding.user.domain.UserProfile;
import com.somaticbuilding.user.infrastructure.mapper.UserProfileMapper;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.Locale;

@Service
public class UserProfileService {
  private final UserProfileMapper userProfileMapper;

  public UserProfileService(UserProfileMapper userProfileMapper) {
    this.userProfileMapper = userProfileMapper;
  }

  public UserProfile getProfile(Long userId) {
    return userProfileMapper.selectOne(
      new LambdaQueryWrapper<UserProfile>()
        .eq(UserProfile::getUserId, userId)
        .eq(UserProfile::getIsDeleted, 0)
    );
  }

  public boolean isDisplayNameAvailable(Long userId, String displayName) {
    String normalizedDisplayName = normalizeDisplayName(displayName);
    if (normalizedDisplayName == null) {
      throw new IllegalArgumentException("Nickname cannot be empty.");
    }

    UserProfile matched = userProfileMapper.selectOne(
      new LambdaQueryWrapper<UserProfile>()
        .eq(UserProfile::getDisplayName, normalizedDisplayName)
        .eq(UserProfile::getIsDeleted, 0)
        .last("LIMIT 1")
    );
    if (matched == null) {
      return true;
    }
    if (userId != null && userId > 0 && matched.getUserId() != null && matched.getUserId().equals(userId)) {
      return true;
    }
    return false;
  }

  public void upsertProfile(Long userId, UserProfile payload) {
    String normalizedDisplayName = normalizeDisplayName(payload.getDisplayName());
    payload.setDisplayName(normalizedDisplayName);
    if (normalizedDisplayName != null && !isDisplayNameAvailable(userId, normalizedDisplayName)) {
      throw new IllegalArgumentException("Nickname already exists. Please choose another one.");
    }

    UserProfile existing = getProfile(userId);
    LocalDateTime now = LocalDateTime.now();
    if (existing == null) {
      payload.setUserId(userId);
      payload.setStatus(1);
      payload.setIsDeleted(0);
      payload.setCreateTime(now);
      payload.setUpdateTime(now);
      userProfileMapper.insert(payload);
      return;
    }
    UserProfile merged = mergeProfile(existing, payload);
    merged.setId(existing.getId());
    merged.setUserId(userId);
    merged.setStatus(existing.getStatus());
    merged.setIsDeleted(existing.getIsDeleted());
    merged.setCreateTime(existing.getCreateTime());
    merged.setUpdateTime(now);
    userProfileMapper.updateById(merged);
  }

  private UserProfile mergeProfile(UserProfile existing, UserProfile payload) {
    UserProfile merged = new UserProfile();
    merged.setDisplayName(payload.getDisplayName() != null ? payload.getDisplayName() : existing.getDisplayName());
    merged.setGender(payload.getGender() != null ? payload.getGender() : existing.getGender());
    merged.setAge(payload.getAge() != null ? payload.getAge() : existing.getAge());
    merged.setHeightCm(payload.getHeightCm() != null ? payload.getHeightCm() : existing.getHeightCm());
    merged.setWeightKg(payload.getWeightKg() != null ? payload.getWeightKg() : existing.getWeightKg());
    merged.setTrainingYears(payload.getTrainingYears() != null ? payload.getTrainingYears() : existing.getTrainingYears());
    merged.setLifestyleNote(payload.getLifestyleNote() != null ? payload.getLifestyleNote() : existing.getLifestyleNote());
    return merged;
  }

  private String normalizeDisplayName(String rawDisplayName) {
    if (rawDisplayName == null) {
      return null;
    }
    String normalized = rawDisplayName.trim();
    if (normalized.isEmpty()) {
      return null;
    }
    if (normalized.length() < 2 || normalized.length() > 24) {
      throw new IllegalArgumentException("Nickname length must be between 2 and 24 characters.");
    }
    String lowered = normalized.toLowerCase(Locale.ROOT);
    if (lowered.contains("@")) {
      throw new IllegalArgumentException("Nickname cannot be an email account.");
    }
    String digitsOnly = normalized.replaceAll("\\D", "");
    if (digitsOnly.length() >= 8 && digitsOnly.equals(normalized.replace(" ", ""))) {
      throw new IllegalArgumentException("Nickname cannot be a phone-like numeric account.");
    }
    return normalized;
  }
}
