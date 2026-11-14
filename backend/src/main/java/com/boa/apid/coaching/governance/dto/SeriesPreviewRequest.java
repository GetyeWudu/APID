package com.boa.apid.coaching.governance.dto;

import com.boa.apid.coaching.governance.entity.CadenceType;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.time.LocalDate;
import java.time.LocalTime;

public record SeriesPreviewRequest(
        @NotNull LocalDate firstSessionDate,
        LocalDate quarterEndDate,
        @NotNull CadenceType cadenceType,
        @NotBlank String daysOfWeek, // "TUESDAY" or "TUESDAY,THURSDAY"
        @NotNull LocalTime preferredStartTime,
        @NotNull @Min(15) Integer durationMinutes,
        @NotNull @Min(1) Integer targetOccurrences
) {}

