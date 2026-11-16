package com.boa.apid.coaching.assignment.dto;

import com.boa.apid.coaching.assignment.entity.ParticipantRole;

import java.time.Instant;

public record CoachingParticipantDto(
        Long id,
        Long assignmentId,
        Long employeeId,
        String employeeNumber,
        String fullName,
        String department,
        ParticipantRole role,
        boolean active,
        Instant createdAt
) {}

