package com.boa.apid.coaching.governance.dto;

import jakarta.validation.constraints.NotNull;
import java.time.LocalDate;
import java.time.LocalTime;

public record CustomSessionSlotDto(
        Integer sequenceNumber,
        @NotNull LocalDate sessionDate,
        @NotNull LocalTime startTime,
        LocalTime endTime
) {}

