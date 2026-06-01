package com.somaticbuilding.training.application;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.somaticbuilding.training.domain.ExerciseLog;
import com.somaticbuilding.training.domain.SetLog;
import com.somaticbuilding.training.domain.TimerLog;
import com.somaticbuilding.training.domain.TrainingRun;
import com.somaticbuilding.training.infrastructure.mapper.ExerciseLogMapper;
import com.somaticbuilding.training.infrastructure.mapper.SetLogMapper;
import com.somaticbuilding.training.infrastructure.mapper.TimerLogMapper;
import com.somaticbuilding.training.infrastructure.mapper.TrainingRunMapper;
import com.somaticbuilding.training.interfaces.dto.TrainingRunSummaryResponse;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.HashSet;
import java.util.List;
import java.util.Objects;
import java.util.Set;

@Service
public class TrainingService {
  private final TrainingRunMapper trainingRunMapper;
  private final SetLogMapper setLogMapper;
  private final TimerLogMapper timerLogMapper;
  private final ExerciseLogMapper exerciseLogMapper;

  public TrainingService(
    TrainingRunMapper trainingRunMapper,
    SetLogMapper setLogMapper,
    TimerLogMapper timerLogMapper,
    ExerciseLogMapper exerciseLogMapper
  ) {
    this.trainingRunMapper = trainingRunMapper;
    this.setLogMapper = setLogMapper;
    this.timerLogMapper = timerLogMapper;
    this.exerciseLogMapper = exerciseLogMapper;
  }

  @Transactional
  public TrainingRun startRun(Long sessionId, Long userId) {
    LocalDateTime now = LocalDateTime.now();
    TrainingRun run = new TrainingRun();
    run.setSessionId(sessionId);
    run.setUserId(userId);
    run.setStartTime(now);
    run.setStatus(1);
    run.setIsDeleted(0);
    run.setCreateTime(now);
    run.setUpdateTime(now);
    trainingRunMapper.insert(run);
    return run;
  }

  @Transactional
  public void updateRunStatus(Long runId, Integer status) {
    TrainingRun existing = trainingRunMapper.selectById(runId);
    if (existing == null || existing.getIsDeleted() == null || existing.getIsDeleted() == 1) {
      throw new IllegalArgumentException("Run not found.");
    }
    TrainingRun patch = new TrainingRun();
    patch.setId(runId);
    patch.setStatus(status);
    patch.setUpdateTime(LocalDateTime.now());
    if (status != null && status == 2) {
      patch.setEndTime(LocalDateTime.now());
    }
    trainingRunMapper.updateById(patch);
  }

  @Transactional
  public SetLog addSetLog(SetLog log) {
    LocalDateTime now = LocalDateTime.now();
    log.setStatus(1);
    log.setIsDeleted(0);
    log.setCreateTime(now);
    log.setUpdateTime(now);
    setLogMapper.insert(log);
    return log;
  }

  @Transactional
  public TimerLog addTimerLog(TimerLog log) {
    LocalDateTime now = LocalDateTime.now();
    log.setStatus(1);
    log.setIsDeleted(0);
    log.setCreateTime(now);
    log.setUpdateTime(now);
    timerLogMapper.insert(log);
    return log;
  }

  @Transactional
  public ExerciseLog addExerciseLog(ExerciseLog log) {
    LocalDateTime now = LocalDateTime.now();
    log.setStatus(1);
    log.setIsDeleted(0);
    log.setCreateTime(now);
    log.setUpdateTime(now);
    exerciseLogMapper.insert(log);
    return log;
  }

  public Page<TrainingRun> listHistory(Long userId, int page, int pageSize) {
    return trainingRunMapper.selectPage(
      new Page<>(page, pageSize),
      new LambdaQueryWrapper<TrainingRun>()
        .eq(TrainingRun::getUserId, userId)
        .eq(TrainingRun::getIsDeleted, 0)
        .orderByDesc(TrainingRun::getStartTime)
    );
  }

  public TrainingRunSummaryResponse getRunSummary(Long runId) {
    TrainingRun run = trainingRunMapper.selectById(runId);
    if (run == null || run.getIsDeleted() == null || run.getIsDeleted() == 1) {
      throw new IllegalArgumentException("Run not found.");
    }

    List<SetLog> setLogs = setLogMapper.selectList(
      new LambdaQueryWrapper<SetLog>()
        .eq(SetLog::getRunId, runId)
        .eq(SetLog::getIsDeleted, 0)
    );
    List<TimerLog> timerLogs = timerLogMapper.selectList(
      new LambdaQueryWrapper<TimerLog>()
        .eq(TimerLog::getRunId, runId)
        .eq(TimerLog::getIsDeleted, 0)
    );
    List<ExerciseLog> exerciseLogs = exerciseLogMapper.selectList(
      new LambdaQueryWrapper<ExerciseLog>()
        .eq(ExerciseLog::getRunId, runId)
        .eq(ExerciseLog::getIsDeleted, 0)
    );

    long totalReps = setLogs.stream()
      .map(SetLog::getReps)
      .filter(Objects::nonNull)
      .mapToLong(Integer::longValue)
      .sum();
    BigDecimal totalWeightKg = setLogs.stream()
      .map(SetLog::getWeightKg)
      .filter(Objects::nonNull)
      .reduce(BigDecimal.ZERO, BigDecimal::add);
    long totalSetDurationSeconds = setLogs.stream()
      .map(SetLog::getDurationSeconds)
      .filter(Objects::nonNull)
      .mapToLong(Integer::longValue)
      .sum();
    long totalTimerDurationSeconds = timerLogs.stream()
      .map(TimerLog::getDurationSeconds)
      .filter(Objects::nonNull)
      .mapToLong(Integer::longValue)
      .sum();

    Set<Long> distinctExerciseIds = new HashSet<>();
    setLogs.stream()
      .map(SetLog::getExerciseId)
      .filter(Objects::nonNull)
      .forEach(distinctExerciseIds::add);
    exerciseLogs.stream()
      .map(ExerciseLog::getExerciseId)
      .filter(Objects::nonNull)
      .forEach(distinctExerciseIds::add);

    long skippedExerciseCount = exerciseLogs.stream()
      .filter(log -> {
        String note = log.getNote();
        return note != null && note.trim().equalsIgnoreCase("skipped");
      })
      .count();

    long durationSeconds = 0;
    if (run.getStartTime() != null) {
      LocalDateTime endTime = run.getEndTime() == null ? LocalDateTime.now() : run.getEndTime();
      durationSeconds = Math.max(0, Duration.between(run.getStartTime(), endTime).getSeconds());
    }
    if (durationSeconds <= 0) {
      durationSeconds = Math.max(totalSetDurationSeconds, totalTimerDurationSeconds);
    }

    TrainingRunSummaryResponse response = new TrainingRunSummaryResponse();
    response.setRunId(run.getId());
    response.setSessionId(run.getSessionId());
    response.setUserId(run.getUserId());
    response.setRunStatus(run.getStatus());
    response.setStartTime(run.getStartTime());
    response.setEndTime(run.getEndTime());
    response.setDurationSeconds(durationSeconds);
    response.setSetLogCount((long) setLogs.size());
    response.setTotalReps(totalReps);
    response.setTotalWeightKg(totalWeightKg);
    response.setTotalSetDurationSeconds(totalSetDurationSeconds);
    response.setTimerLogCount((long) timerLogs.size());
    response.setTotalTimerDurationSeconds(totalTimerDurationSeconds);
    response.setDistinctExerciseCount((long) distinctExerciseIds.size());
    response.setSkippedExerciseCount(skippedExerciseCount);
    return response;
  }
}
