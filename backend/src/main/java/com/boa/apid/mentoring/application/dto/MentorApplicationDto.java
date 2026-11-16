package com.boa.apid.mentoring.application.dto;

import com.boa.apid.mentoring.application.entity.MentorApplication;
import com.boa.apid.mentoring.application.entity.MentorApplicationStatus;
import com.boa.apid.mentoring.application.entity.MentorApplicationType;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

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
        String availabilityNotes,
        Integer maxConcurrentTrainees,
        Instant submittedAt,
        String reviewedByUsername,
        Instant reviewedAt,
        String reviewReason
) {

    public static MentorApplicationDto from(MentorApplication application) {
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
        if (application.getCustomSkill() != null
                && !application.getCustomSkill().isBlank()
                && skillNames.stream().noneMatch(name -> name.equalsIgnoreCase(application.getCustomSkill().trim()))) {
            skillNames.add(application.getCustomSkill().trim());
        }
        String skillName = String.join(", ", skillNames);
        List<Evidence> evidenceFiles = application.getSupportingEvidence().stream()
                .map(file -> new Evidence(file.getId(), file.getOriginalFilename()))
                .sorted(Comparator.comparing(Evidence::fileName, String.CASE_INSENSITIVE_ORDER))
                .toList();
        if (evidenceFiles.isEmpty() && application.getProofDocument() != null) {
            evidenceFiles = List.of(new Evidence(
                    application.getProofDocument().getId(),
                    application.getProofDocument().getOriginalFilename()
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
                application.getProofDocument().getId(),
                application.getProofDocument().getOriginalFilename(),
                evidenceFiles,
                application.getNote(),
                application.getExpertiseSummary(),
                application.getAvailabilityNotes(),
                application.getMaxConcurrentTrainees(),
                application.getSubmittedAt(),
                application.getReviewedBy() == null ? null : application.getReviewedBy().getUsername(),
                application.getReviewedAt(),
                application.getReviewReason()
        );
    }

    public record Evidence(Long fileId, String fileName) {
    }
}
