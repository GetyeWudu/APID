package com.boa.apid.core.config.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.LocalDate;

public record UpdateFiscalQuarterRequest(
        @NotBlank(message = "Label is required")
        @Size(max = 50, message = "Label must be at most 50 characters")
        String label,

        @NotNull(message = "Start date is required")
        LocalDate startDate,

        @NotNull(message = "End date is required")
        LocalDate endDate
) {}

