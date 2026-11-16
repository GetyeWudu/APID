package com.boa.apid.mentoring.pairing.dto;

import com.boa.apid.mentoring.pairing.entity.MentoringRelationshipMemberStatus;
import com.boa.apid.mentoring.pairing.entity.MentoringRelationshipStatus;
import com.boa.apid.mentoring.pairing.entity.MentoringRequestType;

import java.time.Instant;
import java.util.List;

public record MentoringPairingDetailDto(
        Long relationshipId,
        Long requestId,
        MentoringRequestType requestType,
        MentoringRelationshipStatus status,
        Long mentorUserId,
        String mentorName,
        String skillName,
        String requestMessage,
        Instant startedAt,
        Instant endedAt,
        MentoringRelationshipPairDto.ParticipantRole currentUserRole,
        List<Trainee> trainees
) {
    public record Trainee(
            Long userId,
            String name,
            MentoringRelationshipMemberStatus status,
            Instant joinedAt,
            Instant endedAt
    ) {
    }
}
