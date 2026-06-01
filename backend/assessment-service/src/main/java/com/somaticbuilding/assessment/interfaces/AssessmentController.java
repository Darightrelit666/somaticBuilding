package com.somaticbuilding.assessment.interfaces;

import com.somaticbuilding.assessment.application.AssessmentService;
import com.somaticbuilding.assessment.domain.AssessmentResult;
import com.somaticbuilding.assessment.domain.AssessmentSession;
import com.somaticbuilding.assessment.domain.AssessmentStep;
import com.somaticbuilding.assessment.domain.AssessmentTest;
import com.somaticbuilding.assessment.domain.JointMetric;
import com.somaticbuilding.assessment.domain.RiskAlert;
import com.somaticbuilding.assessment.interfaces.dto.AssessmentSummaryResponse;
import com.somaticbuilding.assessment.interfaces.dto.JointMetricResponse;
import com.somaticbuilding.assessment.interfaces.dto.RiskAlertResponse;
import com.somaticbuilding.assessment.interfaces.dto.SessionCreateRequest;
import com.somaticbuilding.assessment.interfaces.dto.SessionResponse;
import com.somaticbuilding.assessment.interfaces.dto.StepRequest;
import com.somaticbuilding.assessment.interfaces.dto.TestResultRequest;
import com.somaticbuilding.assessment.interfaces.dto.TestResponse;
import com.somaticbuilding.common.core.ApiResponse;
import com.somaticbuilding.common.core.ErrorCode;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Objects;

@RestController
@RequestMapping("/api/v1/assessment")
public class AssessmentController {
  private final AssessmentService assessmentService;

  public AssessmentController(AssessmentService assessmentService) {
    this.assessmentService = assessmentService;
  }

  @PostMapping("/session")
  public ApiResponse<Map<String, Object>> createSession(@Valid @RequestBody SessionCreateRequest request) {
    AssessmentSession session = assessmentService.createSession(request.getUserId());
    return ApiResponse.success(Map.of("id", session.getId()));
  }

  @GetMapping("/session/{id}")
  public ApiResponse<SessionResponse> getSession(@PathVariable("id") Long sessionId) {
    AssessmentSession session = assessmentService.getSession(sessionId);
    if (session == null) {
      return ApiResponse.failure(ErrorCode.PARAM_ERROR.getCode(), "Session not found.");
    }
    SessionResponse response = new SessionResponse();
    response.setId(session.getId());
    response.setUserId(session.getUserId());
    response.setStatus(session.getStatus());
    response.setStartTime(session.getStartTime());
    response.setEndTime(session.getEndTime());
    return ApiResponse.success(response);
  }

  @PostMapping("/step")
  public ApiResponse<Map<String, Object>> saveStep(@Valid @RequestBody StepRequest request) {
    AssessmentStep step =
      assessmentService.saveStep(request.getSessionId(), request.getStepType(), request.getStepStatus());
    return ApiResponse.success(Map.of("id", step.getId()));
  }

  @GetMapping("/test/list")
  public ApiResponse<List<TestResponse>> listTests(@RequestParam("session_id") Long sessionId) {
    List<AssessmentTest> tests = assessmentService.listTests(sessionId);
    List<TestResponse> responses = new ArrayList<>();
    for (AssessmentTest test : tests) {
      TestResponse response = new TestResponse();
      response.setId(test.getId());
      response.setName(test.getName());
      response.setCategory(test.getCategory());
      response.setStatus(test.getStatus());
      responses.add(response);
    }
    return ApiResponse.success(responses);
  }

  @PostMapping("/test/result")
  public ApiResponse<Map<String, Object>> saveResult(@Valid @RequestBody TestResultRequest request) {
    AssessmentResult result = assessmentService.saveResult(request.getTestId(), request.getScore(), request.getNote());
    return ApiResponse.success(Map.of("id", result.getId()));
  }

  @GetMapping("/result")
  public ApiResponse<AssessmentSummaryResponse> getSummary(@RequestParam("session_id") Long sessionId) {
    List<AssessmentResult> results = assessmentService.listResultsBySession(sessionId);
    List<Long> resultIds = results.stream()
      .map(AssessmentResult::getId)
      .filter(Objects::nonNull)
      .toList();
    List<JointMetric> metrics = assessmentService.listJointMetrics(resultIds);
    List<RiskAlert> alerts = assessmentService.listRiskAlerts(resultIds);

    List<JointMetricResponse> metricResponses = new ArrayList<>();
    for (JointMetric metric : metrics) {
      JointMetricResponse response = new JointMetricResponse();
      response.setJoint(metric.getJointName());
      response.setMobility(metric.getMobility());
      response.setStability(metric.getStability());
      response.setMotorControl(metric.getMotorControl());
      response.setStatus(metric.getStatus());
      metricResponses.add(response);
    }

    List<RiskAlertResponse> alertResponses = new ArrayList<>();
    for (RiskAlert alert : alerts) {
      RiskAlertResponse response = new RiskAlertResponse();
      response.setJoint(alert.getJointName());
      response.setSeverity(alert.getSeverity());
      response.setMessage(alert.getMessage());
      alertResponses.add(response);
    }

    AssessmentSummaryResponse summary = new AssessmentSummaryResponse();
    summary.setSummary(buildSummary(alertResponses));
    summary.setJointMetrics(metricResponses);
    summary.setRiskAlerts(alertResponses);
    return ApiResponse.success(summary);
  }

  private String buildSummary(List<RiskAlertResponse> alerts) {
    if (alerts == null || alerts.isEmpty()) {
      return "No risk alerts detected.";
    }
    return "Risk alerts detected. Review joint metrics.";
  }
}
