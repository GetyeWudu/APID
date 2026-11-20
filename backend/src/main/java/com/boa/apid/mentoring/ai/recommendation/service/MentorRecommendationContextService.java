package com.boa.apid.mentoring.ai.recommendation.service;

import com.boa.apid.common.exception.BusinessException;
import com.boa.apid.common.storage.StoredFile;
import com.boa.apid.mentoring.application.entity.MentorApplication;
import com.boa.apid.mentoring.application.entity.MentorApplicationType;
import com.boa.apid.mentoring.document.service.MentoringDocumentTextExtractor;
import com.boa.apid.mentoring.trainer.dto.TrainerDirectoryDto;
import com.boa.apid.mentoring.trainer.entity.TrainerAuthorization;
import com.boa.apid.mentoring.trainer.entity.TrainerAuthorizationStatus;
import com.boa.apid.mentoring.trainer.repository.TrainerAuthorizationRepository;
import com.boa.apid.mentoring.trainer.service.TrainerAuthorizationService;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.regex.Pattern;

@Service
public class MentorRecommendationContextService {

    private static final int MAX_CANDIDATES = 40;
    private static final int MAX_PROFILE_CHARS = 2500;
    private static final int MAX_EVIDENCE_CHARS = 1800;
    private static final String PROFILE_TRUNCATION_NOTICE = "[Profile context truncated for request size.]";
    private static final Pattern EMAIL_PATTERN = Pattern.compile(
            "(?i)\\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\\.[A-Z]{2,}\\b"
    );
    private static final Pattern PHONE_PATTERN = Pattern.compile(
            "(?<!\\d)\\+?\\d[\\d\\s().-]{7,}\\d(?!\\d)"
    );
    private final TrainerAuthorizationService authorizationService;
    private final TrainerAuthorizationRepository authorizationRepository;
    private final MentoringDocumentTextExtractor documentTextExtractor;

    public MentorRecommendationContextService(
            TrainerAuthorizationService authorizationService,
            TrainerAuthorizationRepository authorizationRepository,
            MentoringDocumentTextExtractor documentTextExtractor
    ) {
        this.authorizationService = authorizationService;
        this.authorizationRepository = authorizationRepository;
        this.documentTextExtractor = documentTextExtractor;
    }

    @Transactional(readOnly = true)
    public List<MentorCandidateContext> loadCandidates(Long requestingUserId) {
        Map<Long, TrainerDirectoryDto> candidates = new LinkedHashMap<>();
        for (TrainerDirectoryDto mentor : authorizationService.listDirectory(null, null)) {
            if (!mentor.userId().equals(requestingUserId)
                    && mentor.remainingCapacity() > 0) {
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
            result.add(new MentorCandidateContext(mentor, buildProfile(mentor, authorization)));
        }
        return result;
    }

    private String buildProfile(TrainerDirectoryDto mentor, TrainerAuthorization authorization) {
        StringBuilder profile = new StringBuilder();
        append(profile, "Skills", mentor.skills().stream()
                .map(skill -> skill.name() + " (" + skill.category() + ")")
                .toList().toString());
        append(profile, "Department", mentor.departmentName());
        append(profile, "Bio", redact(mentor.bio(), mentor));
        append(profile, "Professional experience (years)", mentor.experienceYears());
        append(profile, "Mentoring approach", redact(mentor.mentoringApproach(), mentor));
        append(profile, "Sessions per week", mentor.sessionsPerWeek());
        append(profile, "Average trainee rating", mentor.averageRating());
        append(profile, "Active trainees", mentor.activeTrainees());
        append(profile, "Available capacity", mentor.remainingCapacity());

        MentorApplication application = authorization.getSourceApplication();
        if (application != null && application.getApplicationType() != MentorApplicationType.INITIAL) {
            application = null;
        }
        if (application != null) {
            append(profile, "Expertise summary", redact(application.getExpertiseSummary(), mentor));
            append(profile, "Application profile", redact(sanitizeApplicationNote(application.getNote()), mentor));
            append(profile, "Application experience (years)", application.getExperienceYears());
            append(profile, "Application mentoring approach",
                    redact(application.getMentoringApproach(), mentor));
            append(profile, "Sessions offered per week", application.getSessionsPerWeek());
            appendEvidence(profile, application, mentor);
        }
        if (profile.length() <= MAX_PROFILE_CHARS) return profile.toString();
        int contentLimit = MAX_PROFILE_CHARS - PROFILE_TRUNCATION_NOTICE.length() - 1;
        int safeLimit = contentLimit > 0 && Character.isHighSurrogate(profile.charAt(contentLimit - 1))
                ? contentLimit - 1
                : contentLimit;
        return profile.substring(0, safeLimit) + "\n" + PROFILE_TRUNCATION_NOTICE;
    }

    private void appendEvidence(
            StringBuilder profile,
            MentorApplication application,
            TrainerDirectoryDto mentor
    ) {
        List<StoredFile> files = new ArrayList<>(application.getSupportingEvidence());
        if (application.getProofDocument() != null
                && files.stream().noneMatch(file -> file.getId().equals(application.getProofDocument().getId()))) {
            files.add(application.getProofDocument());
        }

        int remaining = MAX_EVIDENCE_CHARS;
        boolean unsupportedEvidence = false;
        boolean truncatedEvidence = false;
        for (StoredFile file : files) {
            if (remaining <= 0) {
                truncatedEvidence = true;
                break;
            }
            if (!documentTextExtractor.supports(file.getOriginalFilename())) {
                unsupportedEvidence = true;
                continue;
            }
            MentoringDocumentTextExtractor.ExtractedDocumentText extractedDocument =
                    extractEvidence(file, remaining);
            String extracted = redact(extractedDocument.text(), mentor);
            if (extractedDocument.truncated() || extracted.length() > remaining) truncatedEvidence = true;
            String bounded = extracted.substring(0, Math.min(remaining, extracted.length()));
            if (!bounded.isBlank()) {
                append(profile, "Document evidence", bounded);
                remaining -= bounded.length();
            }
        }
        if (unsupportedEvidence) {
            append(profile, "Evidence note", "Some image or non-text evidence could not be read by the text model.");
        }
        if (truncatedEvidence) {
            append(profile, "Evidence note", "Document text was truncated to fit the recommendation context.");
        }
    }

    private MentoringDocumentTextExtractor.ExtractedDocumentText extractEvidence(StoredFile file, int maxCharacters) {
        try {
            return documentTextExtractor.extract(file.getId(), file.getOriginalFilename(), maxCharacters);
        } catch (BusinessException error) {
            if (!"MENTOR_DOCUMENT_EXTRACTION_FAILED".equals(error.getErrorCode())) throw error;
            throw new BusinessException(
                    "MENTOR_EVIDENCE_EXTRACTION_FAILED",
                    "A mentor evidence document could not be read, so recommendations could not be generated.",
                    error.getStatus()
            );
        }
    }

    private String sanitizeApplicationNote(String note) {
        if (note == null || note.isBlank()) return null;
        return note.lines()
                .filter(line -> {
                    String normalized = line.trim().toLowerCase(Locale.ROOT);
                    return !normalized.startsWith("full name:")
                            && !normalized.startsWith("profile picture:")
                            && !normalized.startsWith("cv:")
                            && !normalized.startsWith("letter of motivation:");
                })
                .reduce((first, second) -> first + "\n" + second)
                .orElse(null);
    }

    private String redact(String value, TrainerDirectoryDto mentor) {
        if (value == null || value.isBlank()) return value;
        String redacted = value;
        if (mentor.fullName() != null && !mentor.fullName().isBlank()) {
            redacted = redacted.replaceAll(
                    "(?i)" + Pattern.quote(mentor.fullName()), "[mentor]"
            );
        }
        return PHONE_PATTERN.matcher(EMAIL_PATTERN.matcher(redacted).replaceAll("[redacted contact]"))
                .replaceAll("[redacted contact]");
    }

    private void append(StringBuilder target, String label, Object value) {
        if (value == null || value.toString().isBlank()) return;
        target.append(label).append(": ").append(value).append('\n');
    }

    public record MentorCandidateContext(TrainerDirectoryDto mentor, String profile) {
    }
}
