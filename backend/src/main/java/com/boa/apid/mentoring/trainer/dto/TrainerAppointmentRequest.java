package com.boa.apid.mentoring.trainer.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.util.List;

public record TrainerAppointmentRequest(
        @NotNull Long employeeId,
        @NotEmpty List<@NotNull Long> skillIds,
        @Min(1) @Max(100) int maxConcurrentTrainees,
        @NotNull @Size(min = 5, max = 1000) String appointmentReason
) {
}
