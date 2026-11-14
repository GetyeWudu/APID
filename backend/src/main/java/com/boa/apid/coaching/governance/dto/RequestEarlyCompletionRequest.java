package com.boa.apid.coaching.governance.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record RequestEarlyCompletionRequest(
        @NotBlank @Size(min = 5, max = 1000) String reason,
        String masteryEvidenceSummary
) {}

