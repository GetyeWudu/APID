package com.boa.apid.mentoring.matching.dto;

public record MentoringReassignmentResultDto(
        Long previousRelationshipId,
        Long newRelationshipId,
        Long trainerUserId,
        String trainerName,
        int reassignedTrainees
) {
}
