package com.somaticbuilding.aiassistant.interfaces;

import com.somaticbuilding.aiassistant.application.AiAssistantService;
import com.somaticbuilding.aiassistant.domain.AssistantMessage;
import com.somaticbuilding.aiassistant.domain.AssistantSession;
import com.somaticbuilding.aiassistant.interfaces.dto.AssistantMessageRequest;
import com.somaticbuilding.aiassistant.interfaces.dto.AssistantMessageResponse;
import com.somaticbuilding.aiassistant.interfaces.dto.AssistantSessionCreateRequest;
import com.somaticbuilding.aiassistant.interfaces.dto.AssistantSessionResponse;
import com.somaticbuilding.aiassistant.interfaces.dto.GoalSynthesisRequest;
import com.somaticbuilding.aiassistant.interfaces.dto.GoalSynthesisResponse;
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

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/v1/assistant")
public class AiAssistantController {
  private final AiAssistantService aiAssistantService;

  public AiAssistantController(AiAssistantService aiAssistantService) {
    this.aiAssistantService = aiAssistantService;
  }

  @PostMapping("/session")
  public ApiResponse<Map<String, Object>> createSession(@Valid @RequestBody AssistantSessionCreateRequest request) {
    AssistantSession session = aiAssistantService.createSession(request.getUserId(), request.getTitle());
    return ApiResponse.success(Map.of("id", session.getId()));
  }

  @GetMapping("/session/{id}")
  public ApiResponse<AssistantSessionResponse> getSession(@PathVariable("id") Long id) {
    AssistantSession session = aiAssistantService.getSession(id);
    if (session == null) {
      return ApiResponse.failure(ErrorCode.PARAM_ERROR.getCode(), "Session not found.");
    }
    AssistantSessionResponse response = new AssistantSessionResponse();
    response.setId(session.getId());
    response.setUserId(session.getUserId());
    response.setTitle(session.getTitle());
    response.setStatus(session.getStatus());
    response.setCreateTime(session.getCreateTime());
    return ApiResponse.success(response);
  }

  @GetMapping("/messages")
  public ApiResponse<List<AssistantMessageResponse>> listMessages(@RequestParam("session_id") Long sessionId) {
    List<AssistantMessage> messages = aiAssistantService.listMessages(sessionId);
    List<AssistantMessageResponse> responses = messages.stream().map(item -> {
      AssistantMessageResponse response = new AssistantMessageResponse();
      response.setId(item.getId());
      response.setRole(item.getRole());
      response.setContent(item.getContent());
      response.setCreateTime(item.getCreateTime());
      return response;
    }).collect(Collectors.toList());
    return ApiResponse.success(responses);
  }

  @PostMapping("/message")
  public ApiResponse<Map<String, Object>> createMessage(@Valid @RequestBody AssistantMessageRequest request) {
    AssistantMessage message =
      aiAssistantService.saveMessage(request.getSessionId(), "user", request.getContent());
    return ApiResponse.success(Map.of("id", message.getId()));
  }

  @PostMapping("/chat")
  public ApiResponse<AssistantMessageResponse> chat(@Valid @RequestBody AssistantMessageRequest request) {
    AssistantMessage message =
      aiAssistantService.chat(request.getSessionId(), request.getContent(), request.getMode());
    AssistantMessageResponse response = new AssistantMessageResponse();
    response.setId(message.getId());
    response.setRole(message.getRole());
    response.setContent(message.getContent());
    response.setCreateTime(message.getCreateTime());
    return ApiResponse.success(response);
  }

  @PostMapping("/goal-synthesis")
  public ApiResponse<GoalSynthesisResponse> goalSynthesis(
    @Valid @RequestBody GoalSynthesisRequest request
  ) {
    GoalSynthesisResponse response = aiAssistantService.goalSynthesis(
      request.getUserId(),
      request.getGoalInput(),
      request.getLifestyleProfile()
    );
    return ApiResponse.success(response);
  }
}
