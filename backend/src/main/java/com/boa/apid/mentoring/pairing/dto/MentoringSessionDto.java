package com.boa.apid.mentoring.pairing.dto;

import com.boa.apid.mentoring.pairing.entity.MentoringDeliveryMode;
import com.boa.apid.mentoring.pairing.entity.MentoringSessionStatus;

import java.time.Instant;
import java.util.List;

public record MentoringSessionDto(
        Long id,
        Long relationshipId,
        Long traineeUserId,       // non-null only for INDIVIDUAL or single-target GROUP sessions
        String traineeName,       // non-null only for INDIVIDUAL or single-target GROUP sessions
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
        Instant createdAt,
        /** INDIVIDUAL | GROUP_ALL | GROUP_SUBSET */
        String sessionScope,
        /** populated for GROUP_SUBSET sessions; null otherwise */
        List<Long> targetTraineeUserIds,
        boolean isGroupSession,
        /** names for targetTraineeUserIds; null for one-to-one sessions */
        List<MentoringSessionParticipantDto> targetTrainees,
        Long proposedByUserId,
        boolean currentUserAccepted,
        int acceptedParticipantCount,
        int participantCount
) {}
