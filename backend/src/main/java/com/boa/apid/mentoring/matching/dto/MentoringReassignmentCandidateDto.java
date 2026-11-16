package com.boa.apid.mentoring.matching.dto;

import com.boa.apid.mentoring.pairing.entity.MentoringRequestType;

import java.time.Instant;
import java.util.List;

public record MentoringReassignmentCandidateDto(
        Long relationshipId,
        Long formerTrainerUserId,
        String formerTrainerName,
        Long skillId,
        String skillName,
        MentoringRequestType requestType,
        Instant startedAt,
        List<Trainee> trainees
) {
    public record Trainee(Long userId, String name) {
    }
}
