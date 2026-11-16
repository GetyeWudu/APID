package com.boa.apid.core.scheduling.dto;

import com.boa.apid.core.scheduling.entity.ParticipationRole;
import java.time.Instant;

public record ConflictDescriptor(
        Long employeeId,
        String employeeName,
        String employeeNumber,
        String conflictingModule,
        ParticipationRole conflictingRole,
        Instant startAt,
        Instant endAt,
        String sessionTitle
) {}

