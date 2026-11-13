package com.boa.apid.coaching.assignment.dto;

import com.boa.apid.coaching.assignment.entity.AssignmentPathway;
import com.boa.apid.coaching.assignment.entity.AssignmentStatus;
import com.boa.apid.coaching.importpms.dto.PmsGoalLineDto;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

public record MyCoachingPlanDto(
        Long assignmentId,
        AssignmentPathway pathway,
        AssignmentStatus status,
        String coachingQuarterLabel,
        String performanceQuarterLabel,
        // Coach info
        Long coachEmployeeId,
        String coachEmployeeNumber,
        String coachFullName,
        String coachDepartment,
        String coachJob,
        String coachEmail,
        // Performance record snapshot
        BigDecimal triggeringRating,
        Short roundedRating,
        List<PmsGoalLineDto> triggeringGoals,
        boolean atRisk,
        Instant lastActivityAt,
        Instant createdAt
) {}

