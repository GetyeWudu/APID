package com.boa.apid.mentoring.ai.recommendation.service;

import com.boa.apid.common.exception.BusinessException;
import com.boa.apid.mentoring.application.entity.MentorApplication;
import com.boa.apid.mentoring.trainer.dto.TrainerDirectoryDto;
import com.boa.apid.mentoring.trainer.dto.MentorDirectoryProfileDto;
import com.boa.apid.mentoring.trainer.entity.TrainerAuthorization;
import com.boa.apid.mentoring.trainer.entity.TrainerAuthorizationStatus;
import com.boa.apid.mentoring.trainer.repository.TrainerAuthorizationRepository;
import com.boa.apid.mentoring.trainer.service.TrainerAuthorizationService;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.AbstractMap;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.regex.Pattern;

@Service
public class MentorRecommendationContextService {

    private static final Logger log = LoggerFactory.getLogger(MentorRecommendationContextService.class);
    private static final int MAX_CANDIDATES = 40;
    private static final int MAX_EXPERIENCE_ENTRIES = 2;
    private static final int MAX_EDUCATION_ENTRIES = 3;
    private static final Pattern EMAIL_PATTERN = Pattern.compile(
            "(?i)\\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\\.[A-Z]{2,}\\b"
    );
    private static final Pattern PHONE_PATTERN = Pattern.compile(
            "(?<!\\d)\\+?\\d[\\d\\s().-]{7,}\\d(?!\\d)"
    );

    private final TrainerAuthorizationService authorizationService;
    private final TrainerAuthorizationRepository authorizationRepository;
    private final ObjectMapper objectMapper;

    public MentorRecommendationContextService(
            TrainerAuthorizationService authorizationService,
            TrainerAuthorizationRepository authorizationRepository,
            ObjectMapper objectMapper
    ) {
        this.authorizationService = authorizationService;
        this.authorizationRepository = authorizationRepository;
        this.objectMapper = objectMapper;
    }

    @Transactional(readOnly = true)
    public List<MentorCandidateContext> loadCandidates(Long requestingUserId) {
        return loadCandidates(requestingUserId, null);
    }

    @Transactional(readOnly = true)
    public List<MentorCandidateContext> loadCandidatesForSkill(Long requestingUserId, Long skillId) {
        return loadCandidates(requestingUserId, skillId);
    }

    private List<MentorCandidateContext> loadCandidates(Long requestingUserId, Long skillId) {
        Map<Long, TrainerDirectoryDto> candidates = new LinkedHashMap<>();
        for (TrainerDirectoryDto mentor : authorizationService.listDirectory(skillId, null)) {
            if (!mentor.userId().equals(requestingUserId) && mentor.remainingCapacity() > 0) {
                candidates.putIfAbsent(mentor.userId(), mentor);
            }
        }
        if (candidates.size() > MAX_CANDIDATES) {
            throw new BusinessException(
                    "MENTOR_RECOMMENDATION_CANDIDATE_LIMIT",
                    "There are too many available mentors to compare in one request. Please use the mentor directory or ask HR for help.",
                    HttpStatus.UNPROCESSABLE_ENTITY
            );
        }

        List<MentorCandidateContext> result = new ArrayList<>();
        for (TrainerDirectoryDto mentor : candidates.values()) {
            TrainerAuthorization authorization = authorizationRepository.findByUserIdAndStatus(
                            mentor.userId(), TrainerAuthorizationStatus.ACTIVE)
                    .stream()
                    .findFirst()
                    .orElseThrow(() -> new IllegalStateException(
                            "An eligible mentor authorization disappeared while building recommendation context."
                    ));
            MentorApplication application = sourceApplication(authorization);
            result.add(new MentorCandidateContext(
                    mentor,
                    application == null ? null : compact(application.getProfileSummary(), 2000, mentor),
                    parseExperiences(application, "General professional experience", "title", mentor),
                    parseExperiences(application, "Previous mentorship experience", "role", mentor),
                    mentor.education() == null ? List.of() : mentor.education().stream()
                            .filter(education -> education != null
                                    && (hasText(education.educationLevel()) || hasText(education.fieldOfStudy())))
                            .limit(MAX_EDUCATION_ENTRIES)
                            .map(education -> new EducationContext(
                                    compact(education.educationLevel(), 50, mentor),
                                    compact(education.fieldOfStudy(), 100, mentor)
                            ))
                            .toList()
            ));
        }
        return result;
    }

    @Transactional(readOnly = true)
    public MentorDirectoryProfileDto loadProfile(Long mentorUserId) {
        TrainerDirectoryDto mentor = authorizationService.getDirectoryMentor(mentorUserId);
        TrainerAuthorization authorization = authorizationRepository.findByUserIdAndStatus(
                        mentorUserId, TrainerAuthorizationStatus.ACTIVE)
                .stream()
                .findFirst()
                .orElseThrow(() -> new IllegalStateException(
                        "An active mentor authorization disappeared while loading profile details."
                ));
        MentorApplication application = sourceApplication(authorization);
        return new MentorDirectoryProfileDto(
                mentor,
                application == null ? null : compact(application.getProfileSummary(), 2000, mentor),
                profileExperiences(parseExperiences(
                        application, "General professional experience", "title", mentor
                )),
                profileExperiences(parseExperiences(
                        application, "Previous mentorship experience", "role", mentor
                ))
        );
    }

    private List<MentorDirectoryProfileDto.Experience> profileExperiences(
            List<ExperienceContext> experiences
    ) {
        return experiences.stream()
                .map(experience -> new MentorDirectoryProfileDto.Experience(
                        experience.role(),
                        experience.organization(),
                        experience.years()
                ))
                .toList();
    }

    private MentorApplication sourceApplication(TrainerAuthorization authorization) {
        return authorization.getSourceApplication();
    }

    private List<ExperienceContext> parseExperiences(
            MentorApplication application,
            String noteKey,
            String roleKey,
            TrainerDirectoryDto mentor
    ) {
        String encoded = applicationNoteValue(application, noteKey);
        if (encoded == null || encoded.isBlank() || encoded.equalsIgnoreCase("No")
                || encoded.equalsIgnoreCase("Not specified")) {
            return List.of();
        }
        try {
            JsonNode entries = objectMapper.readTree(encoded);
            if (entries == null || !entries.isArray()) {
                log.warn("Ignoring malformed {} for mentor user id={}", noteKey, mentor.userId());
                return List.of();
            }
            List<ExperienceContext> result = new ArrayList<>();
            for (JsonNode entry : entries) {
                if (!entry.isObject()) {
                    continue;
                }
                ExperienceContext experience = new ExperienceContext(
                        compact(text(entry, roleKey), 60, mentor),
                        compact(text(entry, "organization"), 50, mentor),
                        compact(text(entry, "years"), 35, mentor)
                );
                if (hasText(experience.role()) || hasText(experience.organization())
                        || hasText(experience.years())) {
                    result.add(experience);
                }
                if (result.size() == MAX_EXPERIENCE_ENTRIES) {
                    break;
                }
            }
            return List.copyOf(result);
        } catch (JsonProcessingException error) {
            log.warn("Ignoring malformed {} for mentor user id={}", noteKey, mentor.userId(), error);
            return List.of();
        }
    }

    private String applicationNoteValue(MentorApplication application, String key) {
        if (application == null || application.getNote() == null) {
            return null;
        }
        return application.getNote().lines()
                .map(line -> {
                    int separator = line.indexOf(':');
                    return separator < 0 ? null : new AbstractMap.SimpleImmutableEntry<>(
                            line.substring(0, separator).trim(),
                            line.substring(separator + 1).trim()
                    );
                })
                .filter(Objects::nonNull)
                .filter(entry -> entry.getKey().equalsIgnoreCase(key))
                .map(Map.Entry::getValue)
                .findFirst()
                .orElse(null);
    }

    private String text(JsonNode object, String field) {
        JsonNode value = object.get(field);
        return value == null || value.isNull() ? null : value.asText(null);
    }

    private String compact(String value, int maxChars, TrainerDirectoryDto mentor) {
        if (!hasText(value)) {
            return null;
        }
        String redacted = redact(value, mentor).trim();
        if (redacted.length() <= maxChars) {
            return redacted;
        }
        int end = Character.isHighSurrogate(redacted.charAt(maxChars - 1)) ? maxChars - 1 : maxChars;
        return redacted.substring(0, end);
    }

    private String redact(String value, TrainerDirectoryDto mentor) {
        String redacted = value;
        if (mentor.fullName() != null && !mentor.fullName().isBlank()) {
            redacted = redacted.replaceAll(
                    "(?i)" + Pattern.quote(mentor.fullName()), "[mentor]"
            );
        }
        return PHONE_PATTERN.matcher(EMAIL_PATTERN.matcher(redacted).replaceAll("[redacted contact]"))
                .replaceAll("[redacted contact]");
    }

    private boolean hasText(String value) {
        return value != null && !value.isBlank();
    }

    public record ExperienceContext(String role, String organization, String years) {
    }

    public record EducationContext(String educationLevel, String fieldOfStudy) {
    }

    public record MentorCandidateContext(
            TrainerDirectoryDto mentor,
            String profileSummary,
            List<ExperienceContext> careerExperience,
            List<ExperienceContext> mentorshipExperience,
            List<EducationContext> education
    ) {
        public MentorCandidateContext(
                TrainerDirectoryDto mentor,
                List<ExperienceContext> careerExperience,
                List<ExperienceContext> mentorshipExperience,
                List<EducationContext> education
        ) {
            this(mentor, null, careerExperience, mentorshipExperience, education);
        }
    }
}
