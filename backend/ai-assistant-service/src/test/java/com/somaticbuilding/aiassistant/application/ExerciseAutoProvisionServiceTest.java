package com.somaticbuilding.aiassistant.application;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.somaticbuilding.aiassistant.domain.ContentAnalysisJob;
import com.somaticbuilding.aiassistant.domain.ContentMovementCandidate;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.beans.factory.ObjectProvider;

import java.util.function.Supplier;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ExerciseAutoProvisionServiceTest {
  @Mock
  private ObjectProvider<ObjectMapper> objectMapperProvider;

  @Mock
  private VideoClipExtractionService videoClipExtractionService;

  private ExerciseAutoProvisionService service;

  @BeforeEach
  void setUp() {
    when(objectMapperProvider.getIfAvailable(any(Supplier.class))).thenReturn(new ObjectMapper());
    service = new ExerciseAutoProvisionService(
      objectMapperProvider,
      videoClipExtractionService,
      true,
      "http://127.0.0.1:1"
    );
  }

  @Test
  void provisionFromLabelRejectsNarrativePlanSentenceBeforeCallingExerciseService() {
    ExerciseAutoProvisionService.ProvisionResult result = service.provisionFromLabel(
      null,
      "为了发展扣篮所需的下肢爆发力，我们将采用Athletic风格",
      "ai_plan_unmapped"
    );

    assertThat(result.success()).isFalse();
    assertThat(result.note()).isEqualTo("unsafe_label");
    verifyNoInteractions(videoClipExtractionService);
  }

  @Test
  void provisionFromCandidateRejectsUnsafeCandidateBeforeExtractingVideoClip() {
    ContentAnalysisJob job = new ContentAnalysisJob();
    job.setSourceUrl("https://example.com/video");

    ContentMovementCandidate candidate = new ContentMovementCandidate();
    candidate.setNormalizedLabel("Designed to improve jumping power through progressive loading");

    ExerciseAutoProvisionService.ProvisionResult result = service.provisionFromCandidate(job, candidate);

    assertThat(result.success()).isFalse();
    assertThat(result.note()).isEqualTo("unsafe_candidate_label");
    verifyNoInteractions(videoClipExtractionService);
  }
}
