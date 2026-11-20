package com.boa.apid.coaching.referral.dto;

import jakarta.validation.constraints.NotBlank;

public record ResolveReferralRequest(
        Long newCoachEmployeeId, // Required if resolutionType == REASSIGN_COACH
        @NotBlank(message = "Resolution action type is required")
        String resolutionType,  // REASSIGN_COACH, HR_PIP, DISMISSED
        @NotBlank(message = "Operational justification / notes are required")
        String notes
) {}
