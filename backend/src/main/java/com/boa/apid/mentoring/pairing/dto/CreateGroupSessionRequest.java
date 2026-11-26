package com.boa.apid.mentoring.pairing.dto;

import com.boa.apid.mentoring.pairing.entity.MentoringDeliveryMode;

import java.time.Instant;
import java.util.List;

/**
 * Request to create a cross-pairing group session.
 * The mentor selects ≥2 trainees from any of their active 1-on-1 relationships.
 * One session is created and projected into each selected trainee's individual pairing.
 *
 * @param participantTraineeUserIds  User IDs of the trainees to invite. Must be ≥2,
 *                                   all must be active trainees of the calling mentor.
 */
public record CreateGroupSessionRequest(
        List<Long> participantTraineeUserIds,
        String title,
        String agenda,
        Instant scheduledStart,
        Instant scheduledEnd,
        MentoringDeliveryMode deliveryMode,
        String meetingUrl,
        String location
) {}
