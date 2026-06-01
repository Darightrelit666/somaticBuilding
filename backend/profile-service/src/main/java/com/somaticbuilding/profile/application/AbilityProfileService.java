package com.somaticbuilding.profile.application;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.somaticbuilding.profile.domain.AbilityHistory;
import com.somaticbuilding.profile.domain.AbilityProfile;
import com.somaticbuilding.profile.infrastructure.mapper.AbilityHistoryMapper;
import com.somaticbuilding.profile.infrastructure.mapper.AbilityProfileMapper;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Service
public class AbilityProfileService {
  private final AbilityProfileMapper profileMapper;
  private final AbilityHistoryMapper historyMapper;
  private final ObjectMapper objectMapper = new ObjectMapper();

  public AbilityProfileService(AbilityProfileMapper profileMapper, AbilityHistoryMapper historyMapper) {
    this.profileMapper = profileMapper;
    this.historyMapper = historyMapper;
  }

  public AbilityProfile latestProfile(Long userId) {
    return profileMapper.selectOne(
      new LambdaQueryWrapper<AbilityProfile>()
        .eq(AbilityProfile::getUserId, userId)
        .eq(AbilityProfile::getIsDeleted, 0)
        .orderByDesc(AbilityProfile::getCreateTime)
        .last("limit 1")
    );
  }

  public List<AbilityHistory> listHistoryByProfile(Long profileId) {
    return historyMapper.selectList(
      new LambdaQueryWrapper<AbilityHistory>()
        .eq(AbilityHistory::getProfileId, profileId)
        .eq(AbilityHistory::getIsDeleted, 0)
        .orderByDesc(AbilityHistory::getRecordTime)
    );
  }

  @Transactional
  public AbilityProfile createProfile(AbilityProfile profile) {
    LocalDateTime now = LocalDateTime.now();
    profile.setStatus(1);
    profile.setIsDeleted(0);
    profile.setCreateTime(now);
    profile.setUpdateTime(now);
    profileMapper.insert(profile);
    insertHistory(profile, now, "Initial profile");
    return profile;
  }

  private void insertHistory(AbilityProfile profile, LocalDateTime now, String note) {
    AbilityHistory history = new AbilityHistory();
    history.setProfileId(profile.getId());
    history.setRecordTime(now);
    history.setNote(note);
    history.setIsDeleted(0);
    history.setCreateTime(now);
    history.setUpdateTime(now);
    try {
      history.setDeltaJson(objectMapper.writeValueAsString(new AbilitySnapshot(
        profile.getStrength(),
        profile.getPower(),
        profile.getEndurance(),
        profile.getMobility(),
        profile.getStability(),
        profile.getSpeed()
      )));
    } catch (JsonProcessingException ex) {
      history.setDeltaJson("{}");
    }
    historyMapper.insert(history);
  }

  private record AbilitySnapshot(
    Integer strength,
    Integer power,
    Integer endurance,
    Integer mobility,
    Integer stability,
    Integer speed
  ) {}

  public List<AbilityHistory> listHistoryByUser(Long userId) {
    AbilityProfile latest = latestProfile(userId);
    if (latest == null) {
      return new ArrayList<>();
    }
    return listHistoryByProfile(latest.getId());
  }
}
