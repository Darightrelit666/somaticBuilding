package com.somaticbuilding.training.interfaces;

import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.somaticbuilding.training.application.TrainingService;
import com.somaticbuilding.training.domain.TrainingRun;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(TrainingController.class)
class TrainingControllerIntegrationTest {
  @Autowired
  private MockMvc mockMvc;

  @Autowired
  private ObjectMapper objectMapper;

  @MockBean
  private TrainingService trainingService;

  @Test
  void startRunReturnsCreatedRunIdEnvelope() throws Exception {
    TrainingRun run = new TrainingRun();
    run.setId(55L);
    run.setSessionId(12L);
    run.setUserId(7L);

    when(trainingService.startRun(12L, 7L)).thenReturn(run);

    mockMvc.perform(
        post("/api/v1/training/run")
          .contentType(MediaType.APPLICATION_JSON)
          .content(objectMapper.writeValueAsString(Map.of(
            "sessionId", 12,
            "userId", 7
          )))
      )
      .andExpect(status().isOk())
      .andExpect(jsonPath("$.code").value(200))
      .andExpect(jsonPath("$.data.id").value(55));
  }

  @Test
  void historyReturnsRealRunRecordsFromTrainingService() throws Exception {
    TrainingRun run = new TrainingRun();
    run.setId(99L);
    run.setSessionId(12L);
    run.setUserId(7L);
    run.setStartTime(LocalDateTime.of(2026, 5, 29, 10, 0));
    run.setEndTime(LocalDateTime.of(2026, 5, 29, 10, 45));

    Page<TrainingRun> page = new Page<>(1, 20);
    page.setRecords(List.of(run));

    when(trainingService.listHistory(eq(7L), eq(1), eq(20))).thenReturn(page);

    mockMvc.perform(get("/api/v1/training/history?user_id=7&page=1&page_size=20"))
      .andExpect(status().isOk())
      .andExpect(jsonPath("$.code").value(200))
      .andExpect(jsonPath("$.data[0].runId").value(99))
      .andExpect(jsonPath("$.data[0].sessionId").value(12))
      .andExpect(jsonPath("$.data[0].startTime").exists())
      .andExpect(jsonPath("$.data[0].endTime").exists());
  }
}
