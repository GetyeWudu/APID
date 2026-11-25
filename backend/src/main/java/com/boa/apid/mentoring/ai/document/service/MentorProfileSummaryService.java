package com.boa.apid.mentoring.ai.document.service;

import com.boa.apid.common.exception.BusinessException;
import com.boa.apid.mentoring.ai.client.MentoringAiClient;
import com.boa.apid.mentoring.application.dto.MentorApplicationDto;
import com.boa.apid.mentoring.application.entity.MentorApplication;
import com.boa.apid.mentoring.application.service.MentorApplicationDocumentService;
import com.boa.apid.mentoring.application.service.MentorApplicationDocumentService.ApplicationDocumentText;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

@Service
public class MentorProfileSummaryService {

    public static final int MAX_SUMMARY_CHARS = 2000;
    private static final int MAX_PROFILE_SOURCE_CHARS = 50_000;

    private final MentorApplicationDocumentService documentService;
    private final MentoringAiClient aiClient;
    private final ObjectMapper objectMapper;

    public MentorProfileSummaryService(
            MentorApplicationDocumentService documentService,
            MentoringAiClient aiClient,
            ObjectMapper objectMapper
    ) {
        this.documentService = documentService;
        this.aiClient = aiClient;
        this.objectMapper = objectMapper;
    }

    @Transactional(readOnly = true)
    public String summarize(MentorApplication profile, List<MentorApplication> additionalEvidenceApplications) {
        String source = buildProfileSource(profile, additionalEvidenceApplications);
        if (source.isBlank()) {
            throw new BusinessException(
                    "MENTOR_PROFILE_SUMMARY_SOURCE_EMPTY",
                    "There is no profile information available to summarize.",
                    HttpStatus.UNPROCESSABLE_ENTITY
            );
        }

        SummaryModel response;
        try {
            response = objectMapper.readValue(
                    aiClient.summarizeMentorProfile(source, MAX_SUMMARY_CHARS),
                    SummaryModel.class
            );
        } catch (JsonProcessingException error) {
            throw invalidResponse();
        }
        if (response == null || response.summary() == null
                || response.summary().isBlank()
                || response.summary().length() > MAX_SUMMARY_CHARS) {
            throw invalidResponse();
        }
        return response.summary().trim();
    }

    private String buildProfileSource(
            MentorApplication profile,
            List<MentorApplication> additionalEvidenceApplications
    ) {
        StringBuilder source = new StringBuilder();
        MentorApplicationDto profileDto = MentorApplicationDto.from(profile);
        appendSection(source, "Mentor skills", String.join(", ", profileDto.skillNames()));
        appendSection(source, "Expertise", profile.getExpertiseSummary());
        appendSection(source, "Years of professional experience", value(profile.getExperienceYears()));
        appendSection(source, "Mentoring approach", profile.getMentoringApproach());
        appendSection(source, "Sessions per week", value(profile.getSessionsPerWeek()));
        appendSection(source, "Maximum concurrent mentees", value(profile.getMaxConcurrentTrainees()));
        appendSection(source, "Profile details and application notes", profile.getNote());

        Map<Long, EvidenceSource> evidenceByFileId = new LinkedHashMap<>();
        List<MentorApplication> applications = new ArrayList<>();
        applications.add(profile);
        if (additionalEvidenceApplications != null) {
            applications.addAll(additionalEvidenceApplications);
        }
        Set<Long> visitedApplications = new LinkedHashSet<>();
        for (MentorApplication application : applications) {
            if (application == null || !visitedApplications.add(application.getId())) {
                continue;
            }
            for (MentorApplicationDto.Evidence evidence : MentorApplicationDto.from(application).evidenceFiles()) {
                if (evidence.fileId() != null) {
                    evidenceByFileId.putIfAbsent(
                            evidence.fileId(),
                            new EvidenceSource(application, evidence)
                    );
                }
            }
        }

        for (EvidenceSource evidence : evidenceByFileId.values()) {
            if (source.length() >= MAX_PROFILE_SOURCE_CHARS) {
                break;
            }
            ApplicationDocumentText document = documentService.extractText(
                    evidence.application().getId(),
                    evidence.evidence().fileId()
            );
            String documentContent = document.text().isBlank()
                    ? "No readable text was extracted."
                    : document.text();
            if (document.truncated()) {
                documentContent += "\n[Document extraction was truncated.]";
            }
            appendSection(
                    source,
                    "Supporting document: " + evidence.evidence().fileName()
                            + " (" + evidence.evidence().context() + ")",
                    documentContent
            );
        }
        return source.toString();
    }

    private void appendSection(StringBuilder source, String heading, String content) {
        if (content == null || content.isBlank() || source.length() >= MAX_PROFILE_SOURCE_CHARS) {
            return;
        }
        String prefix = "\n" + heading + ":\n";
        int remaining = MAX_PROFILE_SOURCE_CHARS - source.length();
        if (remaining <= prefix.length()) {
            return;
        }
        source.append(prefix);
        remaining = MAX_PROFILE_SOURCE_CHARS - source.length();
        String truncationMarker = "\n[Profile source truncated.]";
        if (content.length() > remaining) {
            int contentLimit = Math.max(0, remaining - truncationMarker.length());
            source.append(content, 0, contentLimit);
            if (remaining >= truncationMarker.length()) {
                source.append(truncationMarker);
            }
            return;
        }
        source.append(content);
    }

    private String value(Object value) {
        return value == null ? null : value.toString();
    }

    private BusinessException invalidResponse() {
        return new BusinessException(
                "MENTOR_PROFILE_SUMMARY_INVALID_RESPONSE",
                "The profile summary service returned an invalid response. Please try again.",
                HttpStatus.BAD_GATEWAY
        );
    }

    public record SummaryModel(String summary) {
    }

    private record EvidenceSource(
            MentorApplication application,
            MentorApplicationDto.Evidence evidence
    ) {
    }
}
