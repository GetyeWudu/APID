package com.boa.apid.coaching.session.dto;

import jakarta.validation.constraints.NotBlank;
import java.math.BigDecimal;

public record CreateSessionTurnRequest(
        Integer turnIndex,
        String speakerEmployeeId,
        String speakerName,
        String speakerRole,
        BigDecimal startTimeOffsetSec,
        BigDecimal durationSec,
        String transcriptAmharic,
        String transcriptEnglish,
        @NotBlank(message = "Reconciled transcript text is required")
        String reconciledText
) {}
