package com.somaticbuilding.training.application;

import com.somaticbuilding.training.domain.ExerciseLog;
import com.somaticbuilding.training.domain.SetLog;
import com.somaticbuilding.training.domain.TimerLog;
import com.somaticbuilding.training.domain.TrainingRun;
import com.somaticbuilding.training.infrastructure.mapper.ExerciseLogMapper;
import com.somaticbuilding.training.infrastructure.mapper.SetLogMapper;
import com.somaticbuilding.training.infrastructure.mapper.TimerLogMapper;
import com.somaticbuilding.training.infrastructure.mapper.TrainingRunMapper;
import com.somaticbuilding.training.interfaces.dto.TrainingRunSummaryResponse;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class TrainingServiceTest {
  @Mock
  private TrainingRunMapper trainingRunMapper;

  @Mock
  private SetLogMapper setLogMapper;

  @Mock
  private TimerLogMapper timerLogMapper;

  @Mock
  private ExerciseLogMapper exerciseLogMapper;

  private TrainingService service;

  @BeforeEach
  void setUp() {
    service = new TrainingService(trainingRunMapper, setLogMapper, timerLogMapper, exerciseLogMapper);
  }

  @Test
  void startRunSetsDefaultStatusAndPersistsRun() {
    ArgumentCaptor<TrainingRun> captor = ArgumentCaptor.forClass(TrainingRun.class);

    TrainingRun saved = service.startRun(12L, 7L);

    verify(trainingRunMapper).insert(captor.capture());
    TrainingRun inserted = captor.getValue();
    assertThat(inserted.getSessionId()).isEqualTo(12L);
    assertThat(inserted.getUserId()).isEqualTo(7L);
    assertThat(inserted.getStatus()).isEqualTo(1);
    assertThat(inserted.getIsDeleted()).isZero();
    assertThat(inserted.getStartTime()).isNotNull();
    assertThat(inserted.getCreateTime()).isNotNull();
    assertThat(saved).isSameAs(inserted);
  }

  @Test
  void getRunSummaryAggregatesRealSetTimerAndExerciseLogs() {
    TrainingRun run = new TrainingRun();
    run.setId(99L);
    run.setSessionId(12L);
    run.setUserId(7L);
    run.setStatus(2);
    run.setIsDeleted(0);
    run.setStartTime(LocalDateTime.of(2026, 5, 29, 10, 0));
    run.setEndTime(LocalDateTime.of(2026, 5, 29, 10, 45));

    SetLog setA = new SetLog();
    setA.setExerciseId(100L);
    setA.setReps(8);
    setA.setWeightKg(BigDecimal.valueOf(60));
    setA.setDurationSeconds(45);

    SetLog setB = new SetLog();
    setB.setExerciseId(101L);
    setB.setReps(6);
    setB.setWeightKg(BigDecimal.valueOf(80));
    setB.setDurationSeconds(55);

    TimerLog timer = new TimerLog();
    timer.setDurationSeconds(180);

    ExerciseLog skipped = new ExerciseLog();
    skipped.setExerciseId(102L);
    skipped.setNote("skipped");

    when(trainingRunMapper.selectById(99L)).thenReturn(run);
    when(setLogMapper.selectList(any())).thenReturn(List.of(setA, setB));
    when(timerLogMapper.selectList(any())).thenReturn(List.of(timer));
    when(exerciseLogMapper.selectList(any())).thenReturn(List.of(skipped));

    TrainingRunSummaryResponse summary = service.getRunSummary(99L);

    assertThat(summary.getRunId()).isEqualTo(99L);
    assertThat(summary.getSessionId()).isEqualTo(12L);
    assertThat(summary.getDurationSeconds()).isEqualTo(45 * 60);
    assertThat(summary.getSetLogCount()).isEqualTo(2);
    assertThat(summary.getTotalReps()).isEqualTo(14);
    assertThat(summary.getTotalWeightKg()).isEqualByComparingTo("140");
    assertThat(summary.getTotalSetDurationSeconds()).isEqualTo(100);
    assertThat(summary.getTimerLogCount()).isEqualTo(1);
    assertThat(summary.getTotalTimerDurationSeconds()).isEqualTo(180);
    assertThat(summary.getDistinctExerciseCount()).isEqualTo(3);
    assertThat(summary.getSkippedExerciseCount()).isEqualTo(1);
  }
}
