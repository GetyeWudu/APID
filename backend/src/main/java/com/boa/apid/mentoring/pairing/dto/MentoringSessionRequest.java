package com.boa.apid.mentoring.pairing.dto;

import com.boa.apid.mentoring.pairing.entity.MentoringDeliveryMode;

import java.time.Instant;
import java.util.List;

public record MentoringSessionRequest(
        String title,
        String agenda,
        Instant scheduledStart,
        Instant scheduledEnd,
        MentoringDeliveryMode deliveryMode,
        String meetingUrl,
        String location,
        Long traineeUserId,          // kept for backward compat (single-target); ignored when targetTraineeUserIds is set
        List<Long> targetTraineeUserIds  // null/empty = whole group; one element = single trainee; multiple = subset
) {
    /** Convenience: single-trainee backward-compatible constructor */
    public MentoringSessionRequest(
            String title, String agenda,
            Instant scheduledStart, Instant scheduledEnd,
            MentoringDeliveryMode deliveryMode, String meetingUrl
    ) {
        this(title, agenda, scheduledStart, scheduledEnd, deliveryMode, meetingUrl, null, null, null);
    }

    public MentoringSessionRequest(
            String title, String agenda,
            Instant scheduledStart, Instant scheduledEnd,
            MentoringDeliveryMode deliveryMode, String meetingUrl, String location
    ) {
        this(title, agenda, scheduledStart, scheduledEnd, deliveryMode, meetingUrl, location, null, null);
    }
}
