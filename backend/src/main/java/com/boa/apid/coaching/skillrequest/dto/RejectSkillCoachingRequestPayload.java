package com.boa.apid.coaching.skillrequest.dto;

import jakarta.validation.constraints.NotBlank;

public record RejectSkillCoachingRequestPayload(
        @NotBlank(message = "Rejection feedback reason is mandatory")
        String reviewNotes
) {}

