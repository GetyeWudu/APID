package com.boa.apid.mentoring.application.dto;

import com.boa.apid.mentoring.application.entity.MentorApplication;
import com.boa.apid.mentoring.application.entity.MentorApplicationStatus;

import java.time.Instant;

public record MentorApplicationDto(
        Long id,
        String applicantUsername,
        MentorApplicationStatus status,
        String skillName,
        String proofFileName,
        String note,
        Instant submittedAt
) {

    public static MentorApplicationDto from(MentorApplication application) {
        String skillName = application.getCatalogSkill() != null
                ? application.getCatalogSkill().getName()
                : application.getCustomSkill();

        return new MentorApplicationDto(
                application.getId(),
                application.getApplicant().getUsername(),
                application.getStatus(),
                skillName,
                application.getProofDocument().getOriginalFilename(),
                application.getNote(),
                application.getSubmittedAt()
        );
    }
}
