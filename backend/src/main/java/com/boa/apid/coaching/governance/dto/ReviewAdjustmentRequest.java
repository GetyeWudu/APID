package com.boa.apid.coaching.governance.dto;

import com.boa.apid.coaching.governance.entity.AdjustmentDecision;
import jakarta.validation.constraints.NotNull;

public record ReviewAdjustmentRequest(
        @NotNull AdjustmentDecision decision, // APPROVED or REJECTED
        String decisionNotes
) {}

