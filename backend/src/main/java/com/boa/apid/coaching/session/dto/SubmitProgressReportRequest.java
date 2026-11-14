package com.boa.apid.coaching.session.dto;

import jakarta.validation.constraints.NotBlank;

public record SubmitProgressReportRequest(
        @NotBlank(message = "Progress notes cannot be blank")
        String progressNotes
) {}
