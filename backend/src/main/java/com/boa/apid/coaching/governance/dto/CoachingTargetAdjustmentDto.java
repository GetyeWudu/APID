package com.boa.apid.coaching.governance.dto;

import com.boa.apid.coaching.governance.entity.AdjustmentDecision;
import com.boa.apid.coaching.governance.entity.AdjustmentType;
import java.time.Instant;

public record CoachingTargetAdjustmentDto(
        Long id,
        Long sessionTargetId,
        AdjustmentType adjustmentType,
        Long requestedByEmployeeId,
        String requestedByFullName,
        int previousTarget,
        int proposedTarget,
        String reason,
        Long pmsReviewerId,
        String pmsReviewerFullName,
        AdjustmentDecision pmsDecision,
        String decisionNotes,
        Instant decidedAt,
        Instant createdAt
) {}

