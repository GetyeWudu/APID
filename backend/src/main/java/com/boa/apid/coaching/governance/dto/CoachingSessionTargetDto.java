package com.boa.apid.coaching.governance.dto;

import com.boa.apid.coaching.governance.entity.TargetStatus;
import java.time.Instant;
import java.util.List;

public record CoachingSessionTargetDto(
        Long id,
        Long assignmentId,
        Long skillRequestId,
        Long policyVersionId,
        String policyName,
        int policyBaseline,
        int approvedTarget,
        int plannedOccurrences,
        int completedSessions,
        int remainingApprovedSessions,
        TargetStatus status,
        String justificationNotes,
        Long approvedByUserId,
        Instant approvedAt,
        String earlyCompletionReason,
        Instant earlyCompletedAt,
        List<CoachingTargetAdjustmentDto> adjustmentHistory,
        Instant createdAt
) {}

