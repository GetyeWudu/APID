package com.boa.apid.mentoring.pairing.dto;

import com.boa.apid.mentoring.pairing.entity.MentoringRelationshipMemberStatus;
import com.boa.apid.mentoring.pairing.entity.MentoringRelationshipStatus;
import com.boa.apid.mentoring.pairing.entity.MentoringRequestType;

import java.time.Instant;

public record MentoringRelationshipPairDto(
        Long memberId,
        Long relationshipId,
        Long requestId,
        MentoringRequestType requestType,
        MentoringRelationshipStatus relationshipStatus,
        MentoringRelationshipMemberStatus memberStatus,
        ParticipantRole currentUserRole,
        Long mentorUserId,
        String mentorName,
        Long traineeUserId,
        String traineeName,
        Long skillId,
        String skillName,
        String message,
        Instant startedAt,
        Instant joinedAt,
        Instant endedAt,
        Instant memberEndedAt
) {
    public enum ParticipantRole {
        MENTOR,
        TRAINEE
    }
}
