package com.boa.apid.mentoring.trainer.dto;

import com.boa.apid.mentoring.trainer.entity.MentorBadgeRemovalDisposition;
import com.boa.apid.mentoring.trainer.entity.MentorBadgeRemovalRequestStatus;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record MentorBadgeRemovalDecisionRequest(
        @NotNull MentorBadgeRemovalRequestStatus status,
        MentorBadgeRemovalDisposition disposition,
        @Size(max = 1000) String decisionReason
) {
}
