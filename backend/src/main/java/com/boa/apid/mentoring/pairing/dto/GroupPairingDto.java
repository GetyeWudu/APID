package com.boa.apid.mentoring.pairing.dto;

import com.boa.apid.mentoring.pairing.entity.MentoringRelationshipStatus;

import java.time.Instant;
import java.util.List;

public record GroupPairingDto(
        Long relationshipId,
        MentoringRelationshipStatus status,
        Long mentorUserId,
        String mentorName,
        String skillName,
        Instant startedAt,
        List<GroupMemberDto> members,
        List<Long> sourceRelationshipIds
) {
    public record GroupMemberDto(
            Long memberId,
            Long traineeUserId,
            String traineeName,
            String memberStatus
    ) {}
}
