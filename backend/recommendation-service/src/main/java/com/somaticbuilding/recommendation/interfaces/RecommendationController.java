package com.somaticbuilding.recommendation.interfaces;

import com.somaticbuilding.common.core.ApiResponse;
import com.somaticbuilding.recommendation.application.RecommendationService;
import com.somaticbuilding.recommendation.domain.HistoryLog;
import com.somaticbuilding.recommendation.domain.Recommendation;
import com.somaticbuilding.recommendation.interfaces.dto.HistoryResponse;
import com.somaticbuilding.recommendation.interfaces.dto.RecommendationResponse;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/v1")
public class RecommendationController {
  private final RecommendationService recommendationService;

  public RecommendationController(RecommendationService recommendationService) {
    this.recommendationService = recommendationService;
  }

  @GetMapping("/recommendation")
  public ApiResponse<List<RecommendationResponse>> listRecommendations(@RequestParam("user_id") Long userId) {
    List<Recommendation> recommendations = recommendationService.listRecommendations(userId);
    List<RecommendationResponse> responses = recommendations.stream().map(item -> {
      RecommendationResponse response = new RecommendationResponse();
      response.setId(item.getId());
      response.setRecType(item.getRecType());
      response.setRefId(item.getRefId());
      response.setReason(item.getReason());
      return response;
    }).collect(Collectors.toList());
    return ApiResponse.success(responses);
  }

  @GetMapping("/history")
  public ApiResponse<List<HistoryResponse>> listHistory(@RequestParam("user_id") Long userId) {
    List<HistoryLog> history = recommendationService.listHistory(userId);
    List<HistoryResponse> responses = history.stream().map(item -> {
      HistoryResponse response = new HistoryResponse();
      response.setId(item.getId());
      response.setEventType(item.getEventType());
      response.setRefId(item.getRefId());
      response.setEventTime(item.getEventTime());
      response.setNote(item.getNote());
      return response;
    }).collect(Collectors.toList());
    return ApiResponse.success(responses);
  }
}
