package com.boa.apid.coaching.governance.dto;

import com.boa.apid.coaching.assignment.entity.AssignmentPathway;
import com.boa.apid.coaching.governance.entity.CadenceType;
import java.math.BigDecimal;
import java.time.Instant;

public record CoachingPolicyVersionDto(
        Long id,
        String versionTag,
        String policyName,
        AssignmentPathway pathway,
        BigDecimal minAppraisalRating,
        BigDecimal maxAppraisalRating,
        int baselineSessions,
        int minAllowedSessions,
        int maxAllowedSessions,
        CadenceType defaultCadence,
        boolean coachAdjustmentAllowed,
        boolean requiresPmsApprovalOutsideRange,
        boolean allowExtensions,
        boolean allowEarlyCompletion,
        boolean isActive,
        Instant createdAt
) {}

