package com.boa.apid.core.scheduling.dto;

import com.boa.apid.core.scheduling.entity.ParticipationRole;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import java.time.Instant;
import java.util.List;

public record CreateReservationCommand(
        @NotBlank String sourceModule,
        @NotNull Long sourceSessionId,
        @NotBlank String title,
        @NotNull Instant startAt,
        @NotNull Instant endAt,
        String timezone,
        String meetingMode,
        String meetingLocation,
        String videoCallUrl,
        @NotEmpty List<ParticipantReservationInput> participants
) {
    public record ParticipantReservationInput(
            @NotNull Long employeeId,
            @NotNull ParticipationRole role
    ) {}
}

