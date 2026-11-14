package com.boa.apid.coaching.governance.dto;

import com.boa.apid.coaching.governance.entity.CadenceType;
import java.math.BigDecimal;

public record UpdateCoachingPolicyRequest(
        String policyName,
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

