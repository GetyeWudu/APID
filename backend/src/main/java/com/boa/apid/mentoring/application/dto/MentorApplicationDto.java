package com.boa.apid.mentoring.application.dto;

import com.boa.apid.core.organization.dto.OrganizationLocationDto;
import com.boa.apid.core.organization.entity.Employee;
import com.boa.apid.mentoring.application.entity.MentorApplication;
import com.boa.apid.mentoring.application.entity.MentorApplicationStatus;
import com.boa.apid.mentoring.application.entity.MentorApplicationType;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

public record MentorApplicationDto(
        Long id,
        String applicantUsername,
        MentorApplicationType applicationType,
        MentorApplicationStatus status,
        String skillName,
        List<String> skillNames,
        List<Long> catalogSkillIds,
        String customSkill,
        Long proofFileId,
        String proofFileName,
        List<Evidence> evidenceFiles,
        String note,
        String expertiseSummary,
        String profileSummary,
        Integer maxConcurrentTrainees,
        Instant submittedAt,
        String reviewedByUsername,
        Instant reviewedAt,
        String reviewReason,
        Integer experienceYears,
        String mentoringApproach,
        Integer sessionsPerWeek,
        String mentorAgreementVersion,
        String mentorAgreementText,
        Instant mentorAgreementAcceptedAt,
        List<OrganizationLocationDto> organizationPath
) {

    public static MentorApplicationDto from(MentorApplication application) {
        return from(application, null);
    }

    public static MentorApplicationDto from(MentorApplication application, Employee employee) {
        Map<Long, String> evidenceContexts = parseEvidenceContexts(application.getEvidenceContexts());
        List<String> skillNames = new ArrayList<>(application.getCatalogSkills().stream()
                .map(skill -> skill.getName())
                .toList());
        List<Long> catalogSkillIds = new ArrayList<>(application.getCatalogSkills().stream()
                .map(skill -> skill.getId())
                .toList());
        if (skillNames.isEmpty() && application.getCatalogSkill() != null) {
            skillNames.add(application.getCatalogSkill().getName());
            catalogSkillIds.add(application.getCatalogSkill().getId());
        }
        if (application.getCustomSkill() != null && !application.getCustomSkill().isBlank()) {
            for (String customSkill : application.getCustomSkill().split(";")) {
                String normalizedSkill = customSkill.trim();
                if (!normalizedSkill.isBlank()
                        && skillNames.stream().noneMatch(name -> name.equalsIgnoreCase(normalizedSkill))) {
                    skillNames.add(normalizedSkill);
                }
            }
        }
        String skillName = String.join(", ", skillNames);
        List<Evidence> evidenceFiles = application.getSupportingEvidence().stream()
                .map(file -> new Evidence(
                        file.getId(),
                        file.getOriginalFilename(),
                        evidenceContexts.getOrDefault(file.getId(), "Supporting evidence")
                ))
                .sorted(Comparator.comparing(Evidence::fileName, String.CASE_INSENSITIVE_ORDER))
                .toList();
        if (evidenceFiles.isEmpty() && application.getProofDocument() != null) {
            evidenceFiles = List.of(new Evidence(
                    application.getProofDocument() == null ? null : application.getProofDocument().getId(),
                    application.getProofDocument() == null
                            ? null : application.getProofDocument().getOriginalFilename(),
                    evidenceContexts.getOrDefault(
                            application.getProofDocument().getId(),
                            "Supporting evidence"
                    )
            ));
        }

        return new MentorApplicationDto(
                application.getId(),
                application.getApplicant().getUsername(),
                application.getApplicationType(),
                application.getStatus(),
                skillName,
                skillNames,
                catalogSkillIds,
                application.getCustomSkill(),
                application.getProofDocument() == null ? null : application.getProofDocument().getId(),
                application.getProofDocument() == null ? null : application.getProofDocument().getOriginalFilename(),
                evidenceFiles,
                application.getNote(),
                application.getExpertiseSummary(),
                application.getProfileSummary(),
                application.getMaxConcurrentTrainees(),
                application.getSubmittedAt(),
                application.getReviewedBy() == null ? null : application.getReviewedBy().getUsername(),
                application.getReviewedAt(),
                application.getReviewReason(),
                application.getExperienceYears(),
                application.getMentoringApproach(),
                application.getSessionsPerWeek(),
                application.getMentorAgreementVersion(),
                application.getMentorAgreementText(),
                application.getMentorAgreementAcceptedAt(),
                employee == null ? List.of() : OrganizationLocationDto.path(employee)
        );
    }

    private static Map<Long, String> parseEvidenceContexts(String serialized) {
        Map<Long, String> contexts = new LinkedHashMap<>();
        if (serialized == null || serialized.isBlank()) {
            return contexts;
        }
        for (String line : serialized.split("\\r?\\n")) {
            int separator = line.indexOf('\t');
            if (separator <= 0) {
                throw new IllegalStateException("Invalid mentor application evidence context metadata");
            }
            try {
                contexts.put(Long.parseLong(line.substring(0, separator)), line.substring(separator + 1));
            } catch (NumberFormatException error) {
                throw new IllegalStateException("Invalid mentor application evidence context metadata", error);
            }
        }
        return contexts;
    }

    public record Evidence(Long fileId, String fileName, String context) {
    }
}
