package com.boa.apid.core.scheduling.dto;

import java.util.List;

public record AvailabilityCheckResponse(
        boolean available,
        List<ConflictDescriptor> conflicts
) {
    public static AvailabilityCheckResponse free() {
        return new AvailabilityCheckResponse(true, List.of());
    }

    public static AvailabilityCheckResponse conflict(List<ConflictDescriptor> conflicts) {
        return new AvailabilityCheckResponse(false, conflicts);
    }
}

