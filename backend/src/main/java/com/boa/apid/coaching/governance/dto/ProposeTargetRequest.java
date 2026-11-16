package com.boa.apid.coaching.governance.dto;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record ProposeTargetRequest(
        Long assignmentId,
        Long skillRequestId,
        @NotNull @Min(1) Integer proposedTarget,
        @NotBlank @Size(min = 5, max = 1000) String justificationReason
) {}

