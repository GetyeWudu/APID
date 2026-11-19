package com.boa.apid.mentoring.ai.recommendation.service;

import com.boa.apid.common.exception.BusinessException;
import com.boa.apid.mentoring.ai.client.MentoringAiClient;
import com.boa.apid.mentoring.ai.recommendation.dto.MentorRecommendationDto;
import com.boa.apid.mentoring.ai.recommendation.dto.MentorRecommendationRequest;
import com.boa.apid.mentoring.ai.recommendation.dto.MentorRecommendationResponse;
import com.boa.apid.mentoring.trainer.dto.TrainerDirectoryDto;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
public class MentorRecommendationService {

    private final MentorRecommendationContextService contextService;
    private final MentoringAiClient ollamaClient;
    private final ObjectMapper objectMapper;

    public MentorRecommendationService(
            MentorRecommendationContextService contextService,
            MentoringAiClient ollamaClient,
            ObjectMapper objectMapper
    ) {
        this.contextService = contextService;
        this.ollamaClient = ollamaClient;
        this.objectMapper = objectMapper;
    }

    public MentorRecommendationResponse recommend(MentorRecommendationRequest request, Long userId) {
        List<MentorCandidateContext> candidates = contextService.loadCandidates(userId);
        if (candidates.isEmpty()) {
            return new MentorRecommendationResponse(List.of());
        }

        String prompt = buildPrompt(request.learningGoal(), candidates);
        List<Long> mentorUserIds = candidates.stream()
                .map(candidate -> candidate.mentor().userId())
                .toList();
        List<Long> skillIds = candidates.stream()
                .flatMap(candidate -> candidate.mentor().skills().stream())
                .map(skill -> skill.id())
                .distinct()
                .toList();
        ModelResponse modelResponse = parseResponse(
                ollamaClient.recommend(prompt, mentorUserIds, skillIds)
        );
        Map<Long, MentorCandidateContext> candidatesByUserId = candidates.stream()
                .collect(Collectors.toMap(candidate -> candidate.mentor().userId(), Function.identity()));

        Set<Long> returnedMentorIds = new HashSet<>();
        Set<Integer> returnedRanks = new HashSet<>();
        modelResponse.recommendations().forEach(recommendation -> validateRecommendation(
                recommendation, candidatesByUserId, returnedMentorIds, returnedRanks
        ));
        List<MentorRecommendationDto> recommendations = modelResponse.recommendations().stream()
                .sorted(Comparator.comparingInt(ModelRecommendation::rank))
                .map(recommendation -> toDto(recommendation, candidatesByUserId))
                .toList();
        return new MentorRecommendationResponse(recommendations);
    }

    private String buildPrompt(String learningGoal, List<MentorCandidateContext> candidates) {
        try {
            return objectMapper.writeValueAsString(Map.of(
                    "learningGoal", learningGoal,
                    "candidates", candidates.stream().map(candidate -> Map.of(
                            "mentorUserId", candidate.mentor().userId(),
                            "profile", candidate.profile(),
                            "skills", candidate.mentor().skills().stream().map(skill -> Map.of(
                                    "skillId", skill.id(),
                                    "name", skill.name(),
                                    "category", skill.category() == null ? "" : skill.category()
                            )).toList()
                    )).toList()
            ));
        } catch (JsonProcessingException error) {
            throw new IllegalStateException("Could not encode mentor recommendation context.", error);
        }
    }

    private ModelResponse parseResponse(String response) {
        try {
            ModelResponse parsed = objectMapper.readValue(response, ModelResponse.class);
            if (parsed == null || parsed.recommendations() == null || parsed.recommendations().size() > 5) {
                throw invalidResponse();
            }
            return parsed;
        } catch (JsonProcessingException error) {
            throw invalidResponse();
        }
    }

    private void validateRecommendation(
            ModelRecommendation recommendation,
            Map<Long, MentorCandidateContext> candidates,
            Set<Long> returnedMentorIds,
            Set<Integer> returnedRanks
    ) {
        if (recommendation == null
                || recommendation.mentorUserId() == null
                || !candidates.containsKey(recommendation.mentorUserId())
                || !returnedMentorIds.add(recommendation.mentorUserId())
                || recommendation.rank() < 1
                || recommendation.rank() > 5
                || !returnedRanks.add(recommendation.rank())
                || recommendation.reason() == null
                || recommendation.reason().isBlank()
                || recommendation.reason().length() > 500) {
            throw invalidResponse();
        }
        if (recommendation.skillId() != null && candidates.get(recommendation.mentorUserId())
                .mentor().skills().stream().noneMatch(skill -> skill.id().equals(recommendation.skillId()))) {
            throw invalidResponse();
        }
    }

    private MentorRecommendationDto toDto(
            ModelRecommendation recommendation,
            Map<Long, MentorCandidateContext> candidates
    ) {
        TrainerDirectoryDto mentor = candidates.get(recommendation.mentorUserId()).mentor();
        String skillName = recommendation.skillId() == null ? null : mentor.skills().stream()
                .filter(skill -> skill.id().equals(recommendation.skillId()))
                .map(skill -> skill.name())
                .findFirst()
                .orElseThrow();
        return new MentorRecommendationDto(
                recommendation.rank(),
                recommendation.reason().trim(),
                recommendation.skillId(),
                skillName,
                mentor
        );
    }

    private BusinessException invalidResponse() {
        return new BusinessException(
                "MENTOR_RECOMMENDATION_INVALID_RESPONSE",
                "The recommendation service returned an invalid response. Please try again.",
                HttpStatus.BAD_GATEWAY
        );
    }

    public record ModelResponse(List<ModelRecommendation> recommendations) {
    }

    public record ModelRecommendation(Long mentorUserId, int rank, String reason, Long skillId) {
    }
}
