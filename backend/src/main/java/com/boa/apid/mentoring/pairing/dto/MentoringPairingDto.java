package com.boa.apid.mentoring.pairing.dto;

import com.boa.apid.mentoring.pairing.entity.MentoringRequestRecipientStatus;
import com.boa.apid.mentoring.pairing.entity.MentoringRequestType;

import java.time.Instant;

public record MentoringPairingDto(
        Long id,
        Long requestId,
        MentoringRequestType requestType,
        MentoringRequestRecipientStatus status,
        boolean incoming,
        boolean initiatedByMentor,
        Long mentorUserId,
        String mentorName,
        Long traineeUserId,
        String traineeName,
        Long recipientUserId,
        Long skillId,
        String skillName,
        String message,
        Instant createdAt,
        Instant respondedAt
) {
}
