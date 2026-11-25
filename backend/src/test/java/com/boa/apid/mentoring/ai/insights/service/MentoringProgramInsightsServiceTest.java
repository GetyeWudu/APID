package com.boa.apid.mentoring.ai.insights.service;

import com.boa.apid.mentoring.ai.client.MentoringAiClient;
import com.boa.apid.mentoring.ai.insights.dto.MentoringProgramInsightsDto;
import com.boa.apid.mentoring.trainer.dto.MentoringFeedbackReportDto;
import com.boa.apid.mentoring.trainer.dto.MentoringHrOverviewDto;
import com.boa.apid.mentoring.trainer.dto.MentoringRequestBacklogDto;
import com.boa.apid.mentoring.trainer.service.TrainerAuthorizationService;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.mockito.Mockito;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class MentoringProgramInsightsServiceTest {

    private final TrainerAuthorizationService authorizationService = Mockito.mock(TrainerAuthorizationService.class);
    private final MentoringAiClient aiClient = Mockito.mock(MentoringAiClient.class);
    private final ObjectMapper objectMapper = new ObjectMapper();
    private final MentoringProgramInsightsService service =
            new MentoringProgramInsightsService(authorizationService, aiClient, objectMapper);

    @Test
    void generatesInsightsFromAggregateReportMetricsOnly() throws Exception {
        when(authorizationService.getOverview()).thenReturn(new MentoringHrOverviewDto(
                2, 8, 1, 5, 0, 0, 4, 3, 12, 10, 4.2, 42.9,
                List.of(),
                new MentoringRequestBacklogDto(2, 8.5, 10, 0, 1, 1),
                new MentoringFeedbackReportDto(
                        3,
                        4.2,
                        List.of(new MentoringFeedbackReportDto.RatingDistribution(5, 2)),
                        List.of(new MentoringFeedbackReportDto.MonthlyRating("2026-11", 3, 4.2))
                )
        ));
        when(aiClient.generateMentoringProgramInsights(anyString())).thenReturn("""
                {"summary":"Most relationships are completed.","strengths":["10 of 12 sessions completed"],
                "attentionAreas":["1 request has waited at least 7 days"],
                "recommendedActions":["Review the oldest open requests"]}
                """);

        MentoringProgramInsightsDto insights = service.generate();

        assertEquals("Most relationships are completed.", insights.summary());
        assertEquals(List.of("10 of 12 sessions completed"), insights.strengths());
        assertEquals(List.of("1 request has waited at least 7 days"), insights.attentionAreas());
        assertEquals(List.of("Review the oldest open requests"), insights.recommendedActions());

        ArgumentCaptor<String> reportDataCaptor = ArgumentCaptor.forClass(String.class);
        verify(aiClient).generateMentoringProgramInsights(reportDataCaptor.capture());
        JsonNode reportData = objectMapper.readTree(reportDataCaptor.getValue());
        assertEquals(2, reportData.path("requestBacklog").path("openRequests").asInt());
        assertEquals(3, reportData.path("feedbackReport").path("responseCount").asInt());
        assertFalse(reportData.has("mentorName"));
        assertFalse(reportData.has("sessions"));
    }
}
