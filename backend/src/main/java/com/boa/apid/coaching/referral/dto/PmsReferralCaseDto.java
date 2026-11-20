package com.boa.apid.coaching.referral.dto;

import java.time.Instant;

public record PmsReferralCaseDto(
        Long id,
        Long coacheeEmployeeId,
        String coacheeEmployeeNumber,
        String coacheeFullName,
        String coacheeDepartment,
        String coacheeJobTitle,
        Long currentCoachEmployeeId,
        String currentCoachFullName,
        Long assignmentId,
        int consecutiveLowQuartersCount,
        String latestScoresJson,
        int coachingSessionsAttended,
        String status,
        Long newCoachEmployeeId,
        String newCoachFullName,
        Long pmsAdminUserId,
        String resolutionType,
        String resolutionNotes,
        Instant escalatedAt,
        Instant resolvedAt
) {}
