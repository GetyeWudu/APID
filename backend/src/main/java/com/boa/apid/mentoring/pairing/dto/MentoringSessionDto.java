package com.boa.apid.mentoring.pairing.dto;

import com.boa.apid.mentoring.pairing.entity.MentoringDeliveryMode;
import com.boa.apid.mentoring.pairing.entity.MentoringSessionStatus;

import java.time.Instant;

public record MentoringSessionDto(
        Long id,
        Long relationshipId,
        Long traineeUserId,
        String traineeName,
        String title,
        String agenda,
        Instant scheduledStart,
        Instant scheduledEnd,
        MentoringDeliveryMode deliveryMode,
        String meetingUrl,
        String location,
        MentoringSessionStatus status,
        Long createdByUserId,
        String createdByName,
        String declineReason,
        String rescheduleReason,
        Instant proposedStart,
        Instant proposedEnd,
        Instant respondedAt,
        String cancellationReason,
        String notes,
        Instant createdAt
) {
}
