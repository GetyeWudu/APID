package com.boa.apid.coaching.session.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.time.Instant;

public record ProposeRescheduleRequest(
        @NotNull Instant proposedStartTime,
        @NotBlank String reason
) {}

