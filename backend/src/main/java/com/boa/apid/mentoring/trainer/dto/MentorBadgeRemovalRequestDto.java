package com.boa.apid.mentoring.trainer.dto;

import com.boa.apid.core.organization.dto.OrganizationLocationDto;
import com.boa.apid.mentoring.trainer.entity.MentorBadgeRemovalDisposition;
import com.boa.apid.mentoring.trainer.entity.MentorBadgeRemovalRequestStatus;

import java.time.Instant;
import java.util.List;

public record MentorBadgeRemovalRequestDto(
        Long id,
        Long authorizationId,
        String employeeNumber,
        String mentorName,
        String departmentName,
        List<String> skills,
        String reason,
        MentorBadgeRemovalRequestStatus status,
        Instant requestedAt,
        Instant reviewedAt,
        MentorBadgeRemovalDisposition disposition,
        String decisionReason,
        List<OrganizationLocationDto> organizationPath
) {
}
