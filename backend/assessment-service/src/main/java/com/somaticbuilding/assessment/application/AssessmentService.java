package com.somaticbuilding.assessment.application;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.somaticbuilding.assessment.domain.AssessmentResult;
import com.somaticbuilding.assessment.domain.AssessmentSession;
import com.somaticbuilding.assessment.domain.AssessmentStep;
import com.somaticbuilding.assessment.domain.AssessmentTest;
import com.somaticbuilding.assessment.domain.JointMetric;
import com.somaticbuilding.assessment.domain.RiskAlert;
import com.somaticbuilding.assessment.infrastructure.mapper.AssessmentResultMapper;
import com.somaticbuilding.assessment.infrastructure.mapper.AssessmentSessionMapper;
import com.somaticbuilding.assessment.infrastructure.mapper.AssessmentStepMapper;
import com.somaticbuilding.assessment.infrastructure.mapper.AssessmentTestMapper;
import com.somaticbuilding.assessment.infrastructure.mapper.JointMetricMapper;
import com.somaticbuilding.assessment.infrastructure.mapper.RiskAlertMapper;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;

@Service
public class AssessmentService {
  private final AssessmentSessionMapper sessionMapper;
  private final AssessmentStepMapper stepMapper;
  private final AssessmentTestMapper testMapper;
  private final AssessmentResultMapper resultMapper;
  private final JointMetricMapper jointMetricMapper;
  private final RiskAlertMapper riskAlertMapper;
  private final com.somaticbuilding.assessment.infrastructure.mapper.PostureSnapshotMapper postureSnapshotMapper;
  private final com.somaticbuilding.assessment.infrastructure.mapper.PostureJointStateMapper postureJointStateMapper;

  public AssessmentService(
    AssessmentSessionMapper sessionMapper,
    AssessmentStepMapper stepMapper,
    AssessmentTestMapper testMapper,
    AssessmentResultMapper resultMapper,
    JointMetricMapper jointMetricMapper,
    RiskAlertMapper riskAlertMapper,
    com.somaticbuilding.assessment.infrastructure.mapper.PostureSnapshotMapper postureSnapshotMapper,
    com.somaticbuilding.assessment.infrastructure.mapper.PostureJointStateMapper postureJointStateMapper
  ) {
    this.sessionMapper = sessionMapper;
    this.stepMapper = stepMapper;
    this.testMapper = testMapper;
    this.resultMapper = resultMapper;
    this.jointMetricMapper = jointMetricMapper;
    this.riskAlertMapper = riskAlertMapper;
    this.postureSnapshotMapper = postureSnapshotMapper;
    this.postureJointStateMapper = postureJointStateMapper;
  }

  @Transactional
  public AssessmentSession createSession(Long userId) {
    LocalDateTime now = LocalDateTime.now();
    AssessmentSession session = new AssessmentSession();
    session.setUserId(userId);
    session.setStatus(1);
    session.setStartTime(now);
    session.setIsDeleted(0);
    session.setCreateTime(now);
    session.setUpdateTime(now);
    sessionMapper.insert(session);
    seedDefaultTests(session.getId(), now);
    return session;
  }

  public AssessmentSession getSession(Long id) {
    return sessionMapper.selectOne(
      new LambdaQueryWrapper<AssessmentSession>()
        .eq(AssessmentSession::getId, id)
        .eq(AssessmentSession::getIsDeleted, 0)
    );
  }

  @Transactional
  public AssessmentStep saveStep(Long sessionId, String stepType, Integer stepStatus) {
    LocalDateTime now = LocalDateTime.now();
    AssessmentStep step = new AssessmentStep();
    step.setSessionId(sessionId);
    step.setStepType(stepType);
    step.setStepStatus(stepStatus);
    step.setIsDeleted(0);
    step.setCreateTime(now);
    step.setUpdateTime(now);
    stepMapper.insert(step);
    return step;
  }

  public List<AssessmentTest> listTests(Long sessionId) {
    return testMapper.selectList(
      new LambdaQueryWrapper<AssessmentTest>()
        .eq(AssessmentTest::getSessionId, sessionId)
        .eq(AssessmentTest::getIsDeleted, 0)
        .orderByAsc(AssessmentTest::getId)
    );
  }

  @Transactional
  public AssessmentResult saveResult(Long testId, Integer score, String note) {
    LocalDateTime now = LocalDateTime.now();
    AssessmentResult result = new AssessmentResult();
    result.setTestId(testId);
    result.setScore(score);
    result.setNote(note);
    result.setStatus(1);
    result.setIsDeleted(0);
    result.setCreateTime(now);
    result.setUpdateTime(now);
    resultMapper.insert(result);
    return result;
  }

  public List<AssessmentResult> listResultsBySession(Long sessionId) {
    List<AssessmentTest> tests = listTests(sessionId);
    if (tests.isEmpty()) {
      return new ArrayList<>();
    }
    List<Long> testIds = tests.stream().map(AssessmentTest::getId).filter(Objects::nonNull).toList();
    return resultMapper.selectList(
      new LambdaQueryWrapper<AssessmentResult>()
        .in(AssessmentResult::getTestId, testIds)
        .eq(AssessmentResult::getIsDeleted, 0)
        .orderByDesc(AssessmentResult::getId)
    );
  }

  public List<JointMetric> listJointMetrics(List<Long> resultIds) {
    if (resultIds == null || resultIds.isEmpty()) {
      return new ArrayList<>();
    }
    return jointMetricMapper.selectList(
      new LambdaQueryWrapper<JointMetric>()
        .in(JointMetric::getResultId, resultIds)
        .eq(JointMetric::getIsDeleted, 0)
    );
  }

  public List<RiskAlert> listRiskAlerts(List<Long> resultIds) {
    if (resultIds == null || resultIds.isEmpty()) {
      return new ArrayList<>();
    }
    return riskAlertMapper.selectList(
      new LambdaQueryWrapper<RiskAlert>()
        .in(RiskAlert::getResultId, resultIds)
        .eq(RiskAlert::getIsDeleted, 0)
    );
  }

  @Transactional
  public com.somaticbuilding.assessment.domain.PostureSnapshot createSnapshot(
    Long sessionId,
    String summary,
    List<com.somaticbuilding.assessment.domain.PostureJointState> joints
  ) {
    LocalDateTime now = LocalDateTime.now();
    com.somaticbuilding.assessment.domain.PostureSnapshot snapshot = new com.somaticbuilding.assessment.domain.PostureSnapshot();
    snapshot.setSessionId(sessionId);
    snapshot.setSnapshotTime(now);
    snapshot.setSummary(summary);
    snapshot.setIsDeleted(0);
    snapshot.setCreateTime(now);
    snapshot.setUpdateTime(now);
    postureSnapshotMapper.insert(snapshot);
    if (joints != null) {
      for (com.somaticbuilding.assessment.domain.PostureJointState joint : joints) {
        joint.setSnapshotId(snapshot.getId());
        joint.setIsDeleted(0);
        joint.setCreateTime(now);
        joint.setUpdateTime(now);
        postureJointStateMapper.insert(joint);
      }
    }
    return snapshot;
  }

  public List<com.somaticbuilding.assessment.domain.PostureSnapshot> listSnapshots(Long sessionId) {
    return postureSnapshotMapper.selectList(
      new LambdaQueryWrapper<com.somaticbuilding.assessment.domain.PostureSnapshot>()
        .eq(com.somaticbuilding.assessment.domain.PostureSnapshot::getSessionId, sessionId)
        .eq(com.somaticbuilding.assessment.domain.PostureSnapshot::getIsDeleted, 0)
        .orderByDesc(com.somaticbuilding.assessment.domain.PostureSnapshot::getSnapshotTime)
    );
  }

  public List<com.somaticbuilding.assessment.domain.PostureJointState> listJointStates(List<Long> snapshotIds) {
    if (snapshotIds == null || snapshotIds.isEmpty()) {
      return new ArrayList<>();
    }
    return postureJointStateMapper.selectList(
      new LambdaQueryWrapper<com.somaticbuilding.assessment.domain.PostureJointState>()
        .in(com.somaticbuilding.assessment.domain.PostureJointState::getSnapshotId, snapshotIds)
        .eq(com.somaticbuilding.assessment.domain.PostureJointState::getIsDeleted, 0)
    );
  }

  private void seedDefaultTests(Long sessionId, LocalDateTime now) {
    List<AssessmentTest> defaults = List.of(
      buildTest(sessionId, "Deep Squat", "movement", now),
      buildTest(sessionId, "Hurdle Step", "movement", now),
      buildTest(sessionId, "Inline Lunge", "movement", now),
      buildTest(sessionId, "Shoulder Mobility", "mobility", now),
      buildTest(sessionId, "Active Straight-Leg Raise", "mobility", now),
      buildTest(sessionId, "Trunk Stability Push-Up", "stability", now),
      buildTest(sessionId, "Rotary Stability", "stability", now)
    );
    for (AssessmentTest test : defaults) {
      testMapper.insert(test);
    }
  }

  private AssessmentTest buildTest(Long sessionId, String name, String category, LocalDateTime now) {
    AssessmentTest test = new AssessmentTest();
    test.setSessionId(sessionId);
    test.setName(name);
    test.setCategory(category);
    test.setStatus(0);
    test.setIsDeleted(0);
    test.setCreateTime(now);
    test.setUpdateTime(now);
    return test;
  }
}
