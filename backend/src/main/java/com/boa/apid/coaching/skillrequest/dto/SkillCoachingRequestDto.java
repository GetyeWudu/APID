package com.boa.apid.coaching.skillrequest.dto;

import com.boa.apid.coaching.skillrequest.entity.SkillCoachingRequestStatus;

import java.time.Instant;
import java.util.List;

public record SkillCoachingRequestDto(
        Long id,
        Long requesterEmployeeId,
        String requesterFullName,
        String requesterEmployeeNumber,
        String requesterDepartment,
        Long proposedCoachEmployeeId,
        String proposedCoachFullName,
        String proposedCoachEmployeeNumber,
        Long coachingFiscalQuarterId,
        String coachingQuarterLabel,
        String skillTitle,
        String businessJustification,
        SkillCoachingRequestStatus status,
        Long reviewedByUserId,
        String reviewedByUsername,
        String reviewNotes,
        Instant reviewedAt,
        Instant createdAt,
        List<SkillCoachingTargetItemDto> targets
) {
    public record SkillCoachingTargetItemDto(
            Long id,
            Long employeeId,
            String employeeFullName,
            String employeeNumber,
            String department,
            String position,
            Long createdAssignmentId
    ) {}
}

