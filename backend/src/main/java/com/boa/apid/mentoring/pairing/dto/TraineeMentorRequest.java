package com.boa.apid.mentoring.pairing.dto;

public record TraineeMentorRequest(
        Long mentorUserId,
        Long skillId,
        String message
) {
}
