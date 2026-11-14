package com.boa.apid.coaching.governance.dto;

import java.time.LocalDate;
import java.time.LocalTime;

public record GeneratedDatePreviewDto(
        int sequenceNumber,
        LocalDate sessionDate,
        String dayOfWeek,
        LocalTime startTime,
        LocalTime endTime,
        int weekNumber,
        boolean isBufferWeek,
        String note
) {}

