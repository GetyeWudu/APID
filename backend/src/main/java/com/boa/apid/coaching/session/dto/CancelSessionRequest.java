package com.boa.apid.coaching.session.dto;

import jakarta.validation.constraints.NotBlank;

public record CancelSessionRequest(
        @NotBlank String reason
) {}

