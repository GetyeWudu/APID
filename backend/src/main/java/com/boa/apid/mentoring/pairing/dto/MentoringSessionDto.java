package com.boa.apid.mentoring.pairing.dto;

import com.boa.apid.mentoring.pairing.entity.MentoringDeliveryMode;
import com.boa.apid.mentoring.pairing.entity.MentoringSessionStatus;

import java.time.Instant;

public record MentoringSessionDto(
        Long id,
        Long relationshipId,
        String title,
        String agenda,
        Instant scheduledStart,
        Instant scheduledEnd,
        MentoringDeliveryMode deliveryMode,
        String meetingUrl,
        MentoringSessionStatus status,
        Long createdByUserId,
        String createdByName,
        Instant createdAt
) {
}
