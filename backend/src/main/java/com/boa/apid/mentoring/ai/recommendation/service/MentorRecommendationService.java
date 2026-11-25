package com.boa.apid.mentoring.ai.recommendation.service;

import com.boa.apid.mentoring.ai.client.MentoringAiClient;
import com.boa.apid.mentoring.ai.recommendation.dto.MentorRecommendationDto;
import com.boa.apid.mentoring.ai.recommendation.dto.HrMentorRecommendationRequest;
import com.boa.apid.mentoring.ai.recommendation.dto.MentorRecommendationRequest;
import com.boa.apid.mentoring.ai.recommendation.dto.MentorRecommendationResponse;
import com.boa.apid.mentoring.ai.recommendation.service.MentorRecommendationContextService.MentorCandidateContext;
import com.boa.apid.mentoring.trainer.dto.TrainerDirectoryDto;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class MentorRecommendationService {

    private static final Logger log = LoggerFactory.getLogger(MentorRecommendationService.class);
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
        return recommend(request.learningGoal(), null, userId, false);
    }

    public MentorRecommendationResponse recommendForHrMatch(HrMentorRecommendationRequest request, Long userId) {
        return recommend(request.learningGoal(), request.skillId(), userId, true);
    }

    private MentorRecommendationResponse recommend(
            String learningGoal,
            Long requestedSkillId,
            Long userId,
            boolean exactSkillPrompt
    ) {
        String requestId = UUID.randomUUID().toString();
        List<MentorCandidateContext> candidates = exactSkillPrompt
                ? contextService.loadCandidatesForSkill(userId, requestedSkillId)
                : contextService.loadCandidates(userId);
        if (candidates.isEmpty()) {
            log.info("Mentor recommendation has no available candidates requestId={}", requestId);
            return new MentorRecommendationResponse(null, List.of());
        }

        List<MentorCandidateContext> eligibleCandidates = exactSkillPrompt
                ? candidates.stream()
                        .filter(candidate -> candidate.mentor().skills().stream()
                                .anyMatch(skill -> skill.id().equals(requestedSkillId)))
                        .toList()
                : candidates;
        if (eligibleCandidates.isEmpty()) {
            log.info("Mentor recommendation has no candidates for exact skill requestId={} skillId={}",
                    requestId, requestedSkillId);
            return new MentorRecommendationResponse(null, List.of());
        }

        String prompt = buildPrompt(learningGoal, requestedSkillId, eligibleCandidates);
        List<Long> mentorUserIds = eligibleCandidates.stream()
                .map(candidate -> candidate.mentor().userId())
                .toList();
        List<Long> skillIds = exactSkillPrompt
                ? List.of(requestedSkillId)
                : eligibleCandidates.stream()
                        .flatMap(candidate -> candidate.mentor().skills().stream())
                        .map(skill -> skill.id())
                        .distinct()
                        .toList();
        ModelResponse modelResponse = parseResponse(
                exactSkillPrompt
                        ? ollamaClient.recommendExactSkill(prompt, mentorUserIds, skillIds)
                        : ollamaClient.recommend(prompt, mentorUserIds, skillIds)
        );
        List<ModelRecommendation> modelRecommendations = modelResponse.recommendations();
        Map<Long, MentorCandidateContext> candidatesByUserId = eligibleCandidates.stream()
                .collect(Collectors.toMap(candidate -> candidate.mentor().userId(), candidate -> candidate));

        Set<Long> returnedMentorIds = new HashSet<>();
        Set<Integer> returnedRanks = new HashSet<>();
        List<ModelRecommendation> acceptedModelRecommendations = new ArrayList<>();
        for (ModelRecommendation recommendation : modelRecommendations) {
            if (validateRecommendation(
                    recommendation,
                    requestedSkillId,
                    exactSkillPrompt,
                    candidatesByUserId,
                    returnedMentorIds,
                    returnedRanks
            )) {
                acceptedModelRecommendations.add(recommendation);
            } else {
                log.info("Mentor recommendation discarded by backend validation requestId={} recommendation={}",
                        requestId, recommendation);
            }
        }
        log.info("Mentor recommendation accepted from model requestId={} recommendations={}",
                requestId, acceptedModelRecommendations);
        List<MentorRecommendationDto> recommendations = acceptedModelRecommendations.stream()
                .sorted(Comparator.comparingInt(ModelRecommendation::rank))
                .map(recommendation -> toDto(recommendation, candidatesByUserId))
                .toList();
        return new MentorRecommendationResponse(
                modelResponse.overallReason() == null
                        ? null
                        : replaceIdentifiersWithNames(modelResponse.overallReason(), eligibleCandidates),
                recommendations
        );
    }

    private String buildPrompt(
            String learningGoal,
            Long requestedSkillId,
            List<MentorCandidateContext> candidates
    ) {
        try {
            return objectMapper.writeValueAsString(new RecommendationPrompt(
                    learningGoal,
                    requestedSkillId,
                    candidates.stream().map(candidate -> {
                        TrainerDirectoryDto mentor = candidate.mentor();
                        return new CandidatePrompt(
                                mentor.userId(),
                                mentor.fullName(),
                                mentor.skills().stream()
                                        .filter(skill -> requestedSkillId == null
                                                || skill.id().equals(requestedSkillId))
                                        .map(skill -> new SkillPrompt(skill.id(), skill.name()))
                                        .toList(),
                                mentor.experienceYears(),
                                candidate.profileSummary(),
                                mentor.averageRating()
                        );
                    }).toList()
            ));
        } catch (JsonProcessingException error) {
            throw new IllegalStateException("Could not encode mentor recommendation context.", error);
        }
    }

    private ModelResponse parseResponse(String response) {
        try {
            ModelResponse parsed = objectMapper.readValue(response, ModelResponse.class);
            if (parsed == null || parsed.recommendations() == null) {
                return new ModelResponse(null, List.of());
            }
            return new ModelResponse(
                    parsed.overallReason(),
                    parsed.recommendations().stream().limit(5).toList()
            );
        } catch (JsonProcessingException error) {
            log.error("Could not parse mentor recommendation model response rawResponse={}", response, error);
            return new ModelResponse(null, List.of());
        }
    }

    private boolean validateRecommendation(
            ModelRecommendation recommendation,
            Long requestedSkillId,
            boolean exactSkillPrompt,
            Map<Long, MentorCandidateContext> candidates,
            Set<Long> returnedMentorIds,
            Set<Integer> returnedRanks
    ) {
        if (recommendation == null
                || recommendation.mentorUserId() == null
                || !candidates.containsKey(recommendation.mentorUserId())
                || recommendation.rank() < 1
                || recommendation.rank() > 5
                || recommendation.reason() == null
                || recommendation.reason().isBlank()
                || recommendation.reason().length() > 500) {
            return false;
        }
        MentorCandidateContext candidate = candidates.get(recommendation.mentorUserId());
        if (exactSkillPrompt
                && (requestedSkillId == null || !requestedSkillId.equals(recommendation.skillId()))) {
            return false;
        }
        if (recommendation.skillId() != null && candidate.mentor().skills().stream()
                .noneMatch(skill -> skill.id().equals(recommendation.skillId()))) {
            return false;
        }
        return returnedMentorIds.add(recommendation.mentorUserId())
                && returnedRanks.add(recommendation.rank());
    }

    private MentorRecommendationDto toDto(
            ModelRecommendation recommendation,
            Map<Long, MentorCandidateContext> candidates
    ) {
        MentorCandidateContext candidate = candidates.get(recommendation.mentorUserId());
        TrainerDirectoryDto mentor = candidate.mentor();
        String skillName = recommendation.skillId() == null ? null : mentor.skills().stream()
                .filter(skill -> skill.id().equals(recommendation.skillId()))
                .map(skill -> skill.name())
                .findFirst()
                .orElseThrow();
        return new MentorRecommendationDto(
                recommendation.rank(),
                replaceIdentifiersWithNames(recommendation.reason().trim(), candidates.values()),
                recommendation.skillId(),
                skillName,
                candidate.profileSummary(),
                candidate.careerExperience(),
                candidate.mentorshipExperience(),
                mentor
        );
    }

    private String replaceIdentifiersWithNames(
            String text,
            Iterable<MentorCandidateContext> candidates
    ) {
        String result = text;
        for (MentorCandidateContext candidate : candidates) {
            TrainerDirectoryDto mentor = candidate.mentor();
            result = replaceLabeledIdentifier(
                    result,
                    "(?:mentor(?:\\s+user)?|user)",
                    mentor.userId(),
                    mentor.fullName()
            );
            for (var skill : mentor.skills()) {
                result = replaceLabeledIdentifier(result, "skill", skill.id(), skill.name());
            }
        }
        return result;
    }

    private String replaceLabeledIdentifier(String text, String label, Long id, String displayName) {
        if (id == null || displayName == null || displayName.isBlank()) {
            return text;
        }
        String identifier = "(?i)\\b" + label + "\\s*(?:id\\s*)?[:#]?\\s*"
                + Pattern.quote(id.toString()) + "\\b";
        return Pattern.compile(identifier)
                .matcher(text)
                .replaceAll(Matcher.quoteReplacement(displayName));
    }

    public record ModelResponse(String overallReason, List<ModelRecommendation> recommendations) {
    }

    public record ModelRecommendation(
            Long mentorUserId,
            int rank,
            String reason,
            Long skillId,
            RankingFactors rankingFactors
    ) {
    }

    public record RankingFactors(
            int careerExperience,
            int mentorshipExperience,
            int educationRelevance,
            Double rating
    ) {
    }

    private record RecommendationPrompt(String learningGoal, Long requestedSkillId, List<CandidatePrompt> candidates) {
    }

    private record CandidatePrompt(
            Long mentorUserId,
            String mentorName,
            List<SkillPrompt> skills,
            Integer careerExperienceYears,
            String profileSummary,
            Double rating
    ) {
    }

    private record SkillPrompt(Long skillId, String name) {
    }
}
