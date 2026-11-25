package com.boa.apid.mentoring.ai.insights.service;

import com.boa.apid.common.exception.BusinessException;
import com.boa.apid.mentoring.ai.client.MentoringAiClient;
import com.boa.apid.mentoring.ai.insights.dto.MentoringProgramInsightsDto;
import com.boa.apid.mentoring.trainer.dto.MentoringHrOverviewDto;
import com.boa.apid.mentoring.trainer.service.TrainerAuthorizationService;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class MentoringProgramInsightsService {

    private final TrainerAuthorizationService authorizationService;
    private final MentoringAiClient aiClient;
    private final ObjectMapper objectMapper;

    public MentoringProgramInsightsService(
            TrainerAuthorizationService authorizationService,
            MentoringAiClient aiClient,
            ObjectMapper objectMapper
    ) {
        this.authorizationService = authorizationService;
        this.aiClient = aiClient;
        this.objectMapper = objectMapper;
    }

    public MentoringProgramInsightsDto generate() {
        String reportData;
        try {
            MentoringHrOverviewDto overview = authorizationService.getOverview();
            reportData = objectMapper.writeValueAsString(overview);
        } catch (JsonProcessingException error) {
            throw invalidResponse();
        }

        MentoringProgramInsightsDto insights;
        try {
            insights = objectMapper.readValue(
                    aiClient.generateMentoringProgramInsights(reportData),
                    MentoringProgramInsightsDto.class
            );
        } catch (JsonProcessingException error) {
            throw invalidResponse();
        }
        if (!isValid(insights)) {
            throw invalidResponse();
        }
        return new MentoringProgramInsightsDto(
                insights.summary().trim(),
                cleanItems(insights.strengths()),
                cleanItems(insights.attentionAreas()),
                cleanItems(insights.recommendedActions())
        );
    }

    private boolean isValid(MentoringProgramInsightsDto insights) {
        return insights != null
                && insights.summary() != null
                && !insights.summary().isBlank()
                && insights.summary().length() <= 600
                && isValidItems(insights.strengths())
                && isValidItems(insights.attentionAreas())
                && isValidItems(insights.recommendedActions());
    }

    private boolean isValidItems(List<String> items) {
        return items != null && items.size() <= 3
                && items.stream().allMatch(item -> item != null && !item.isBlank() && item.length() <= 280);
    }

    private List<String> cleanItems(List<String> items) {
        return items.stream().map(String::trim).toList();
    }

    private BusinessException invalidResponse() {
        return new BusinessException(
                "MENTORING_PROGRAM_INSIGHTS_INVALID_RESPONSE",
                "The mentoring insights service returned an invalid response. Please try again.",
                HttpStatus.BAD_GATEWAY
        );
    }
}
