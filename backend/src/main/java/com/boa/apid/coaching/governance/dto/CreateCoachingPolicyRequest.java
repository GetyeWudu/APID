package com.boa.apid.coaching.governance.dto;

import com.boa.apid.coaching.assignment.entity.AssignmentPathway;
import com.boa.apid.coaching.governance.entity.CadenceType;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;

public record CreateCoachingPolicyRequest(
        String versionTag,
        @NotBlank String policyName,
        @NotNull AssignmentPathway pathway,
        BigDecimal minAppraisalRating,
        BigDecimal maxAppraisalRating,
        int baselineSessions,
        int minAllowedSessions,
        int maxAllowedSessions,
        CadenceType defaultCadence,
        Boolean coachAdjustmentAllowed,
        Boolean requiresPmsApprovalOutsideRange,
        Boolean allowExtensions,
        Boolean allowEarlyCompletion
) {}

