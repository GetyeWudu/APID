package com.boa.apid.core.scheduling.dto;

import com.boa.apid.core.scheduling.entity.ParticipationRole;
import com.boa.apid.core.scheduling.entity.ReservationStatus;
import com.boa.apid.core.scheduling.entity.ScheduleEventStatus;
import java.time.Instant;
import java.util.List;

public record ScheduleEventDto(
        Long id,
        String sourceModule,
        Long sourceSessionId,
        String title,
        Instant startAt,
        Instant endAt,
        String timezone,
        ScheduleEventStatus status,
        String meetingMode,
        String meetingLocation,
        String videoCallUrl,
        ParticipationRole myRole,
        List<ScheduleParticipantDto> participants
) {
    public record ScheduleParticipantDto(
            Long id,
            Long employeeId,
            String employeeName,
            String employeeNumber,
            ParticipationRole participationRole,
            ReservationStatus reservationStatus
    ) {}
}

