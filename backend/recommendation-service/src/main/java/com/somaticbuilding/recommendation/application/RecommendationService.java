package com.somaticbuilding.recommendation.application;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.somaticbuilding.recommendation.domain.HistoryLog;
import com.somaticbuilding.recommendation.domain.Recommendation;
import com.somaticbuilding.recommendation.infrastructure.mapper.HistoryLogMapper;
import com.somaticbuilding.recommendation.infrastructure.mapper.RecommendationMapper;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

@Service
public class RecommendationService {
  private final RecommendationMapper recommendationMapper;
  private final HistoryLogMapper historyLogMapper;

  public RecommendationService(RecommendationMapper recommendationMapper, HistoryLogMapper historyLogMapper) {
    this.recommendationMapper = recommendationMapper;
    this.historyLogMapper = historyLogMapper;
  }

  public List<Recommendation> listRecommendations(Long userId) {
    return recommendationMapper.selectList(
      new LambdaQueryWrapper<Recommendation>()
        .eq(Recommendation::getUserId, userId)
        .eq(Recommendation::getIsDeleted, 0)
        .eq(Recommendation::getStatus, 1)
        .orderByDesc(Recommendation::getCreateTime)
    );
  }

  public List<HistoryLog> listHistory(Long userId) {
    return historyLogMapper.selectList(
      new LambdaQueryWrapper<HistoryLog>()
        .eq(HistoryLog::getUserId, userId)
        .eq(HistoryLog::getIsDeleted, 0)
        .orderByDesc(HistoryLog::getEventTime)
    );
  }

  @Transactional
  public Recommendation createRecommendation(Long userId, String recType, Long refId, String reason) {
    LocalDateTime now = LocalDateTime.now();
    Recommendation recommendation = new Recommendation();
    recommendation.setUserId(userId);
    recommendation.setRecType(recType);
    recommendation.setRefId(refId);
    recommendation.setReason(reason);
    recommendation.setStatus(1);
    recommendation.setIsDeleted(0);
    recommendation.setCreateTime(now);
    recommendation.setUpdateTime(now);
    recommendationMapper.insert(recommendation);
    return recommendation;
  }

  @Transactional
  public HistoryLog createHistory(Long userId, String eventType, Long refId, String note) {
    LocalDateTime now = LocalDateTime.now();
    HistoryLog historyLog = new HistoryLog();
    historyLog.setUserId(userId);
    historyLog.setEventType(eventType);
    historyLog.setRefId(refId);
    historyLog.setEventTime(now);
    historyLog.setNote(note);
    historyLog.setIsDeleted(0);
    historyLog.setCreateTime(now);
    historyLog.setUpdateTime(now);
    historyLogMapper.insert(historyLog);
    return historyLog;
  }
}
