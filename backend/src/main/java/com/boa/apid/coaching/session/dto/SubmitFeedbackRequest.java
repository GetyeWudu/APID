package com.boa.apid.coaching.session.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

public record SubmitFeedbackRequest(
        @NotNull @Min(1) @Max(5) Short rating,
        String comment
) {}

