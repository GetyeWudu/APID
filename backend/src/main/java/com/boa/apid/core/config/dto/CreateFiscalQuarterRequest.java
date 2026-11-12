package com.boa.apid.core.config.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.LocalDate;

public record CreateFiscalQuarterRequest(
        @NotBlank(message = "Fiscal year is required")
        @Size(max = 20, message = "Fiscal year must be at most 20 characters")
        String fiscalYear,

        @NotNull(message = "Quarter (1-4) is required")
        @Min(value = 1, message = "Quarter must be between 1 and 4")
        @Max(value = 4, message = "Quarter must be between 1 and 4")
        Integer quarter,

        @Size(max = 50, message = "Label must be at most 50 characters")
        String label,

        @NotNull(message = "Start date is required")
        LocalDate startDate,

        @NotNull(message = "End date is required")
        LocalDate endDate,

        boolean activate
) {}

