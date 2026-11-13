package com.boa.apid.coaching.skillrequest.dto;

import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.util.List;

public record CreateSkillCoachingRequestPayload(
        @NotEmpty(message = "At least one target employee must be selected")
        List<Long> targetEmployeeIds,

        Long proposedCoachEmployeeId,

        @NotNull(message = "Coaching quarter is required")
        Long coachingFiscalQuarterId,

        @NotEmpty(message = "Skill title is required")
        @Size(max = 200, message = "Skill title must not exceed 200 characters")
        String skillTitle,

        @NotEmpty(message = "Business justification is required")
        String businessJustification
) {}

