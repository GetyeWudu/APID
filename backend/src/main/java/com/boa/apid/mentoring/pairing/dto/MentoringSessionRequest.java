package com.boa.apid.mentoring.pairing.dto;

import com.boa.apid.mentoring.pairing.entity.MentoringDeliveryMode;

import java.time.Instant;

public record MentoringSessionRequest(
        String title,
        String agenda,
        Instant scheduledStart,
        Instant scheduledEnd,
        MentoringDeliveryMode deliveryMode,
        String meetingUrl
) {
}
