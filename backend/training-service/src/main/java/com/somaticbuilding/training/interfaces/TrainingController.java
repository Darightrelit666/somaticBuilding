package com.somaticbuilding.training.interfaces;

import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.somaticbuilding.common.core.ApiResponse;
import com.somaticbuilding.training.application.TrainingService;
import com.somaticbuilding.training.domain.ExerciseLog;
import com.somaticbuilding.training.domain.SetLog;
import com.somaticbuilding.training.domain.TimerLog;
import com.somaticbuilding.training.domain.TrainingRun;
import com.somaticbuilding.training.interfaces.dto.ExerciseLogRequest;
import com.somaticbuilding.training.interfaces.dto.RunCreateRequest;
import com.somaticbuilding.training.interfaces.dto.RunUpdateRequest;
import com.somaticbuilding.training.interfaces.dto.SetLogRequest;
import com.somaticbuilding.training.interfaces.dto.TimerLogRequest;
import com.somaticbuilding.training.interfaces.dto.TrainingHistoryResponse;
import com.somaticbuilding.training.interfaces.dto.TrainingRunSummaryResponse;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/v1/training")
public class TrainingController {
  private final TrainingService trainingService;

  public TrainingController(TrainingService trainingService) {
    this.trainingService = trainingService;
  }

  @PostMapping("/run")
  public ApiResponse<Map<String, Object>> startRun(@Valid @RequestBody RunCreateRequest request) {
    TrainingRun run = trainingService.startRun(request.getSessionId(), request.getUserId());
    return ApiResponse.success(Map.of("id", run.getId()));
  }

  @PutMapping("/run/{id}")
  public ApiResponse<Void> updateRun(@PathVariable("id") Long id, @Valid @RequestBody RunUpdateRequest request) {
    trainingService.updateRunStatus(id, request.getStatus());
    return ApiResponse.success(null);
  }

  @GetMapping("/run/{id}/summary")
  public ApiResponse<TrainingRunSummaryResponse> getRunSummary(@PathVariable("id") Long id) {
    return ApiResponse.success(trainingService.getRunSummary(id));
  }

  @PostMapping("/set-log")
  public ApiResponse<Map<String, Object>> addSetLog(@Valid @RequestBody SetLogRequest request) {
    SetLog log = new SetLog();
    log.setRunId(request.getRunId());
    log.setExerciseId(request.getExerciseId());
    log.setSetIndex(request.getSetIndex());
    log.setReps(request.getReps());
    log.setWeightKg(request.getWeightKg());
    log.setDurationSeconds(request.getDurationSeconds());
    SetLog saved = trainingService.addSetLog(log);
    return ApiResponse.success(Map.of("id", saved.getId()));
  }

  @PostMapping("/timer-log")
  public ApiResponse<Map<String, Object>> addTimerLog(@Valid @RequestBody TimerLogRequest request) {
    TimerLog log = new TimerLog();
    log.setRunId(request.getRunId());
    log.setPhaseType(request.getPhaseType());
    log.setDurationSeconds(request.getDurationSeconds());
    log.setStartTime(defaultTime(request.getStartTime()));
    log.setEndTime(defaultTime(request.getEndTime()));
    TimerLog saved = trainingService.addTimerLog(log);
    return ApiResponse.success(Map.of("id", saved.getId()));
  }

  @PostMapping("/exercise-log")
  public ApiResponse<Map<String, Object>> addExerciseLog(@Valid @RequestBody ExerciseLogRequest request) {
    ExerciseLog log = new ExerciseLog();
    log.setRunId(request.getRunId());
    log.setExerciseId(request.getExerciseId());
    log.setStartTime(defaultTime(request.getStartTime()));
    log.setEndTime(defaultTime(request.getEndTime()));
    log.setNote(request.getNote());
    ExerciseLog saved = trainingService.addExerciseLog(log);
    return ApiResponse.success(Map.of("id", saved.getId()));
  }

  @GetMapping("/history")
  public ApiResponse<List<TrainingHistoryResponse>> history(
    @RequestParam("user_id") Long userId,
    @RequestParam(value = "page", required = false, defaultValue = "1") Integer page,
    @RequestParam(value = "page_size", required = false, defaultValue = "20") Integer pageSize
  ) {
    Page<TrainingRun> result = trainingService.listHistory(userId, page, pageSize);
    List<TrainingHistoryResponse> items =
      result.getRecords().stream().map(run -> {
        TrainingHistoryResponse response = new TrainingHistoryResponse();
        response.setRunId(run.getId());
        response.setSessionId(run.getSessionId());
        response.setStartTime(run.getStartTime());
        response.setEndTime(run.getEndTime());
        return response;
      }).collect(Collectors.toList());
    return ApiResponse.success(items);
  }

  private LocalDateTime defaultTime(LocalDateTime value) {
    return value == null ? LocalDateTime.now() : value;
  }
}
