package com.boa.apid.mentoring.trainer.dto;

import jakarta.validation.constraints.Size;

public record MentorBadgeRemovalRequestBody(
        @Size(max = 1000) String reason
) {
}
