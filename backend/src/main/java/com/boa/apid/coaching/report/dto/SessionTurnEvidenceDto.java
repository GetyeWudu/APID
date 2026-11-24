package com.boa.apid.coaching.report.dto;

import java.math.BigDecimal;

public record SessionTurnEvidenceDto(
        Long turnId,
        int turnIndex,
        String speakerName,
        String speakerRole,
        BigDecimal startTimeOffsetSec,
        BigDecimal durationSec,
        String transcriptEnglish,
        String transcriptAmharic,
        String reconciledText
) {}
