package com.boa.apid.coaching.session.dto;

import java.math.BigDecimal;
import java.time.Instant;

public record CoachingSessionTurnDto(
        Long id,
        Long sessionId,
        Integer turnIndex,
        String speakerEmployeeId,
        String speakerName,
        String speakerRole,
        BigDecimal startTimeOffsetSec,
        BigDecimal durationSec,
        String transcriptAmharic,
        String transcriptEnglish,
        String reconciledText,
        Instant createdAt
) {}
