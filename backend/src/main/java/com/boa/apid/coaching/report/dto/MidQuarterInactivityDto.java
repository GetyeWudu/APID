package com.boa.apid.coaching.report.dto;

import java.time.Instant;

public record MidQuarterInactivityDto(
        Long assignmentId,
        Long coachEmployeeId,
        String coachName,
        String coachStaffId,
        String coachEmail,
        String coacheeName,
        String coacheeStaffId,
        String coacheeEmail,
        String department,
        String district,
        int elapsedWeeks,
        int completedSessions,
        int targetSessions,
        String severity,
        Instant lastActivityAt,
        String recommendedAction
) {}
