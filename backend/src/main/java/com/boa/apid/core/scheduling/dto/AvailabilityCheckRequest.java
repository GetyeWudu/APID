package com.boa.apid.core.scheduling.dto;

import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import java.time.Instant;
import java.util.List;

public record AvailabilityCheckRequest(
        @NotEmpty List<Long> employeeIds,
        @NotNull Instant startAt,
        @NotNull Instant endAt,
        String sourceModule,
        Long excludeSourceSessionId
) {}

