package com.boa.apid.mentoring.collaboration.dto;

import com.boa.apid.mentoring.pairing.entity.MentoringRelationshipStatus;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record MentoringRelationshipStatusRequest(
        @NotNull MentoringRelationshipStatus status,
        @NotNull @Size(min = 5, max = 1000) String reason
) {
}
