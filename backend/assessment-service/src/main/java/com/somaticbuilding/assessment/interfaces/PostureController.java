package com.somaticbuilding.assessment.interfaces;

import com.somaticbuilding.assessment.application.AssessmentService;
import com.somaticbuilding.assessment.domain.PostureJointState;
import com.somaticbuilding.assessment.domain.PostureSnapshot;
import com.somaticbuilding.assessment.interfaces.dto.PostureJointStateRequest;
import com.somaticbuilding.assessment.interfaces.dto.PostureJointStateResponse;
import com.somaticbuilding.assessment.interfaces.dto.PostureSnapshotCreateRequest;
import com.somaticbuilding.assessment.interfaces.dto.PostureSnapshotResponse;
import com.somaticbuilding.common.core.ApiResponse;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/v1/posture")
public class PostureController {
  private final AssessmentService assessmentService;

  public PostureController(AssessmentService assessmentService) {
    this.assessmentService = assessmentService;
  }

  @PostMapping("/snapshot")
  public ApiResponse<Map<String, Object>> createSnapshot(@Valid @RequestBody PostureSnapshotCreateRequest request) {
    List<PostureJointState> joints = new ArrayList<>();
    if (request.getJoints() != null) {
      for (PostureJointStateRequest item : request.getJoints()) {
        PostureJointState joint = new PostureJointState();
        joint.setJointName(item.getJointName());
        joint.setStatus(item.getStatus());
        joint.setNote(item.getNote());
        joints.add(joint);
      }
    }
    PostureSnapshot snapshot =
      assessmentService.createSnapshot(request.getSessionId(), request.getSummary(), joints);
    return ApiResponse.success(Map.of("id", snapshot.getId()));
  }

  @GetMapping("/snapshot")
  public ApiResponse<List<PostureSnapshotResponse>> listSnapshots(@RequestParam("session_id") Long sessionId) {
    List<PostureSnapshot> snapshots = assessmentService.listSnapshots(sessionId);
    List<Long> snapshotIds = snapshots.stream().map(PostureSnapshot::getId).collect(Collectors.toList());
    List<PostureJointState> joints = assessmentService.listJointStates(snapshotIds);

    List<PostureSnapshotResponse> responses = new ArrayList<>();
    for (PostureSnapshot snapshot : snapshots) {
      PostureSnapshotResponse response = new PostureSnapshotResponse();
      response.setId(snapshot.getId());
      response.setSnapshotTime(snapshot.getSnapshotTime());
      response.setSummary(snapshot.getSummary());
      List<PostureJointStateResponse> jointResponses = new ArrayList<>();
      for (PostureJointState joint : joints) {
        if (!snapshot.getId().equals(joint.getSnapshotId())) {
          continue;
        }
        PostureJointStateResponse jointResponse = new PostureJointStateResponse();
        jointResponse.setJointName(joint.getJointName());
        jointResponse.setStatus(joint.getStatus());
        jointResponse.setNote(joint.getNote());
        jointResponses.add(jointResponse);
      }
      response.setJoints(jointResponses);
      responses.add(response);
    }
    return ApiResponse.success(responses);
  }
}
