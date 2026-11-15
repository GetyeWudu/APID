package com.boa.apid.coaching.report.dto;

import com.boa.apid.coaching.session.entity.CoachAssessment;

import java.math.BigDecimal;
import java.time.Instant;

public record PmsTalentProgressItemDto(
        Long assignmentId,
        Long coacheeEmployeeId,
        String coacheeStaffId,
        String coacheeName,
        String department,
        String directorate,
        BigDecimal startingRating,
        String ratingBand,
        String targetWeaknessKpi,
        Long coachEmployeeId,
        String coachName,
        int approvedTarget,
        int completedSessions,
        int remainingSessions,
        double deliveryPercentage,
        CoachAssessment latestAssessment,
        String progressTrajectory,
        boolean attentionRequired,
        String attentionReason,
        Instant lastSessionDate,
        Instant nextScheduledDate,
        int totalLoggedSessions,
        int missedSessionsCount
) {}

