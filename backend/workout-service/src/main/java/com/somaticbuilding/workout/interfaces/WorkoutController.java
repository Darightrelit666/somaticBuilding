package com.somaticbuilding.workout.interfaces;

import com.somaticbuilding.common.core.ApiResponse;
import com.somaticbuilding.common.core.ErrorCode;
import com.somaticbuilding.workout.application.WorkoutSessionService;
import com.somaticbuilding.workout.domain.TemplateExercise;
import com.somaticbuilding.workout.domain.WorkoutBlock;
import com.somaticbuilding.workout.domain.WorkoutExercise;
import com.somaticbuilding.workout.domain.WorkoutGroup;
import com.somaticbuilding.workout.domain.WorkoutSession;
import com.somaticbuilding.workout.domain.WorkoutTemplate;
import com.somaticbuilding.workout.interfaces.dto.BlockResponse;
import com.somaticbuilding.workout.interfaces.dto.ExerciseCreateRequest;
import com.somaticbuilding.workout.interfaces.dto.ExerciseResponse;
import com.somaticbuilding.workout.interfaces.dto.GroupCreateRequest;
import com.somaticbuilding.workout.interfaces.dto.GroupResponse;
import com.somaticbuilding.workout.interfaces.dto.SessionCreateRequest;
import com.somaticbuilding.workout.interfaces.dto.SessionResponse;
import com.somaticbuilding.workout.interfaces.dto.SessionUpdateRequest;
import com.somaticbuilding.workout.interfaces.dto.TemplateCreateRequest;
import com.somaticbuilding.workout.interfaces.dto.TemplateExerciseRequest;
import com.somaticbuilding.workout.interfaces.dto.TemplateExerciseResponse;
import com.somaticbuilding.workout.interfaces.dto.TemplateResponse;
import com.somaticbuilding.workout.interfaces.dto.TemplateUpdateRequest;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/v1/workout")
public class WorkoutController {
  private final WorkoutSessionService workoutSessionService;

  public WorkoutController(WorkoutSessionService workoutSessionService) {
    this.workoutSessionService = workoutSessionService;
  }

  @PostMapping("/session")
  public ApiResponse<Map<String, Object>> createSession(@Valid @RequestBody SessionCreateRequest request) {
    List<String> blocks = workoutSessionService.normalizeBlocks(request.getBlockNames());
    WorkoutSession session =
      workoutSessionService.createSession(
        request.getUserId(),
        request.getSessionName(),
        request.getTrainingStyle(),
        blocks,
        request.getTemplateId()
      );
    return ApiResponse.success(Map.of("id", session.getId()));
  }

  @GetMapping("/session/{id}")
  public ApiResponse<SessionResponse> getSession(@PathVariable("id") Long sessionId) {
    WorkoutSession session = workoutSessionService.getSession(sessionId);
    if (session == null) {
      return ApiResponse.failure(ErrorCode.PARAM_ERROR.getCode(), "Session not found.");
    }
    List<WorkoutBlock> blocks = workoutSessionService.listBlocks(sessionId);
    List<Long> blockIds = blocks.stream().map(WorkoutBlock::getId).collect(Collectors.toList());
    List<WorkoutGroup> groups = workoutSessionService.listGroups(blockIds);
    List<Long> groupIds = groups.stream().map(WorkoutGroup::getId).collect(Collectors.toList());
    List<WorkoutExercise> exercises = workoutSessionService.listExercises(groupIds);

    List<BlockResponse> blockResponses = new ArrayList<>();
    for (WorkoutBlock block : blocks) {
      BlockResponse blockResponse = new BlockResponse();
      blockResponse.setId(block.getId());
      blockResponse.setBlockName(block.getBlockName());
      blockResponse.setOrderIndex(block.getOrderIndex());
      List<GroupResponse> groupResponses = new ArrayList<>();
      for (WorkoutGroup group : groups) {
        if (!group.getBlockId().equals(block.getId())) {
          continue;
        }
        GroupResponse groupResponse = new GroupResponse();
        groupResponse.setId(group.getId());
        groupResponse.setGroupType(group.getGroupType());
        groupResponse.setOrderIndex(group.getOrderIndex());
        List<ExerciseResponse> exerciseResponses = new ArrayList<>();
        for (WorkoutExercise exercise : exercises) {
          if (!exercise.getGroupId().equals(group.getId())) {
            continue;
          }
          ExerciseResponse exerciseResponse = new ExerciseResponse();
          exerciseResponse.setId(exercise.getId());
          exerciseResponse.setExerciseId(exercise.getExerciseId());
          exerciseResponse.setSets(exercise.getSets());
          exerciseResponse.setReps(exercise.getReps());
          exerciseResponse.setRestSeconds(exercise.getRestSeconds());
          exerciseResponse.setTimeSeconds(exercise.getTimeSeconds());
          exerciseResponse.setRounds(exercise.getRounds());
          exerciseResponse.setOrderIndex(exercise.getOrderIndex());
          exerciseResponses.add(exerciseResponse);
        }
        groupResponse.setExercises(exerciseResponses);
        groupResponses.add(groupResponse);
      }
      blockResponse.setGroups(groupResponses);
      blockResponses.add(blockResponse);
    }
    SessionResponse response = new SessionResponse();
    response.setId(session.getId());
    response.setSessionName(session.getSessionName());
    response.setTrainingStyle(session.getTrainingStyle());
    response.setBlocks(blockResponses);
    return ApiResponse.success(response);
  }

  @PutMapping("/session/{id}")
  public ApiResponse<Void> updateSession(@PathVariable("id") Long sessionId, @Valid @RequestBody SessionUpdateRequest request) {
    workoutSessionService.updateSession(sessionId, request.getSessionName(), request.getTrainingStyle());
    return ApiResponse.success(null);
  }

  @PostMapping("/group")
  public ApiResponse<Map<String, Object>> addGroup(@Valid @RequestBody GroupCreateRequest request) {
    WorkoutGroup group = workoutSessionService.addGroup(request.getBlockId(), request.getGroupType(), request.getOrderIndex());
    return ApiResponse.success(Map.of("id", group.getId()));
  }

  @PostMapping("/exercise")
  public ApiResponse<Map<String, Object>> addExercise(@Valid @RequestBody ExerciseCreateRequest request) {
    WorkoutExercise exercise = new WorkoutExercise();
    exercise.setGroupId(request.getGroupId());
    exercise.setExerciseId(request.getExerciseId());
    exercise.setSets(request.getSets());
    exercise.setReps(request.getReps());
    exercise.setRestSeconds(request.getRestSeconds());
    exercise.setTimeSeconds(request.getTimeSeconds());
    exercise.setRounds(request.getRounds());
    exercise.setOrderIndex(request.getOrderIndex());
    WorkoutExercise saved = workoutSessionService.addExercise(exercise);
    return ApiResponse.success(Map.of("id", saved.getId()));
  }

  @DeleteMapping("/exercise/{id}")
  public ApiResponse<Void> removeExercise(@PathVariable("id") Long id) {
    workoutSessionService.removeExercise(id);
    return ApiResponse.success(null);
  }

  @GetMapping("/template/list")
  public ApiResponse<List<TemplateResponse>> listTemplates(
    @RequestParam("user_id") Long userId,
    @RequestParam(value = "kind", required = false, defaultValue = "all") String kind
  ) {
    List<TemplateResponse> templates =
      workoutSessionService.listTemplates(userId, kind).stream().map(template -> {
        TemplateResponse response = new TemplateResponse();
        response.setId(template.getId());
        response.setTemplateName(workoutSessionService.getTemplateDisplayName(template));
        response.setTemplateKind(workoutSessionService.getTemplateKind(template));
        response.setShareCode(workoutSessionService.getTemplateShareCode(template));
        return response;
      }).collect(Collectors.toList());
    return ApiResponse.success(templates);
  }

  @PostMapping("/template")
  public ApiResponse<Map<String, Object>> createTemplate(@Valid @RequestBody TemplateCreateRequest request) {
    List<TemplateExercise> exercises = new ArrayList<>();
    if (request.getExercises() != null) {
      for (TemplateExerciseRequest item : request.getExercises()) {
        TemplateExercise exercise = new TemplateExercise();
        exercise.setExerciseId(item.getExerciseId());
        exercise.setSets(item.getSets());
        exercise.setReps(item.getReps());
        exercise.setRestSeconds(item.getRestSeconds());
        exercise.setTimeSeconds(item.getTimeSeconds());
        exercise.setRounds(item.getRounds());
        exercise.setOrderIndex(item.getOrderIndex());
        exercises.add(exercise);
      }
    }
    WorkoutTemplate template =
      workoutSessionService.createTemplate(
        request.getUserId(),
        request.getTemplateName(),
        request.getTemplateKind(),
        exercises
      );
    return ApiResponse.success(Map.of("id", template.getId()));
  }

  @PutMapping("/template/{id}")
  public ApiResponse<Void> updateTemplate(
    @PathVariable("id") Long id,
    @Valid @RequestBody TemplateUpdateRequest request
  ) {
    List<TemplateExercise> exercises = null;
    if (request.getExercises() != null) {
      exercises = new ArrayList<>();
      for (TemplateExerciseRequest item : request.getExercises()) {
        TemplateExercise exercise = new TemplateExercise();
        exercise.setExerciseId(item.getExerciseId());
        exercise.setSets(item.getSets());
        exercise.setReps(item.getReps());
        exercise.setRestSeconds(item.getRestSeconds());
        exercise.setTimeSeconds(item.getTimeSeconds());
        exercise.setRounds(item.getRounds());
        exercise.setOrderIndex(item.getOrderIndex());
        exercises.add(exercise);
      }
    }
    workoutSessionService.updateTemplate(
      id,
      request.getTemplateName(),
      request.getTemplateKind(),
      exercises
    );
    return ApiResponse.success(null);
  }

  @GetMapping("/template/{id}")
  public ApiResponse<Map<String, Object>> templateDetail(@PathVariable("id") Long id) {
    WorkoutTemplate template = workoutSessionService.getTemplate(id);
    if (template == null) {
      return ApiResponse.failure(ErrorCode.PARAM_ERROR.getCode(), "Template not found.");
    }
    List<TemplateExerciseResponse> exercises = mapTemplateExercises(id);
    return ApiResponse.success(buildTemplateDetailPayload(template, exercises));
  }

  @GetMapping("/template/{id}/share")
  public ApiResponse<Map<String, Object>> shareTemplate(@PathVariable("id") Long id) {
    WorkoutTemplate template = workoutSessionService.getTemplate(id);
    if (template == null) {
      return ApiResponse.failure(ErrorCode.PARAM_ERROR.getCode(), "Template not found.");
    }
    String shareCode = workoutSessionService.getTemplateShareCode(template);
    return ApiResponse.success(Map.of(
      "id", template.getId(),
      "templateName", workoutSessionService.getTemplateDisplayName(template),
      "templateKind", workoutSessionService.getTemplateKind(template),
      "shareCode", shareCode,
      "sharePath", "/s/" + shareCode
    ));
  }

  @GetMapping("/template/share/{shareCode}")
  public ApiResponse<Map<String, Object>> templateDetailByShareCode(
    @PathVariable("shareCode") String shareCode
  ) {
    WorkoutTemplate template = workoutSessionService.getTemplateByShareCode(shareCode);
    if (template == null) {
      return ApiResponse.failure(ErrorCode.PARAM_ERROR.getCode(), "Shared template not found.");
    }
    List<TemplateExerciseResponse> exercises = mapTemplateExercises(template.getId());
    return ApiResponse.success(buildTemplateDetailPayload(template, exercises));
  }

  @DeleteMapping("/template/{id}")
  public ApiResponse<Void> deleteTemplate(@PathVariable("id") Long id) {
    workoutSessionService.deleteTemplate(id);
    return ApiResponse.success(null);
  }

  private List<TemplateExerciseResponse> mapTemplateExercises(Long templateId) {
    return workoutSessionService.listTemplateExercises(templateId).stream().map(item -> {
      TemplateExerciseResponse response = new TemplateExerciseResponse();
      response.setExerciseId(item.getExerciseId());
      response.setSets(item.getSets());
      response.setReps(item.getReps());
      response.setRestSeconds(item.getRestSeconds());
      response.setTimeSeconds(item.getTimeSeconds());
      response.setRounds(item.getRounds());
      response.setOrderIndex(item.getOrderIndex());
      return response;
    }).collect(Collectors.toList());
  }

  private Map<String, Object> buildTemplateDetailPayload(
    WorkoutTemplate template,
    List<TemplateExerciseResponse> exercises
  ) {
    String templateName = workoutSessionService.getTemplateDisplayName(template);
    String templateKind = workoutSessionService.getTemplateKind(template);
    String shareCode = workoutSessionService.getTemplateShareCode(template);
    return Map.of(
      "id", template.getId(),
      "templateName", templateName,
      "templateKind", templateKind,
      "shareCode", shareCode,
      "sharePath", "/s/" + shareCode,
      "exercises", exercises
    );
  }
}
