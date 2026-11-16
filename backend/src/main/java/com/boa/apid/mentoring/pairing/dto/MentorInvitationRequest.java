package com.boa.apid.mentoring.pairing.dto;

import com.boa.apid.mentoring.pairing.entity.MentoringRequestType;

import java.util.List;

public record MentorInvitationRequest(
        MentoringRequestType requestType,
        List<Long> traineeUserIds,
        Long skillId,
        String message
) {
}
