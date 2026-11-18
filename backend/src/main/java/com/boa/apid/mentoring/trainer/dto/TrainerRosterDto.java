package com.boa.apid.mentoring.trainer.dto;

import com.boa.apid.mentoring.trainer.entity.TrainerAuthorizationSource;
import com.boa.apid.mentoring.trainer.entity.TrainerAuthorizationStatus;

import java.time.Instant;
import java.util.List;

public record TrainerRosterDto(
        Long id,
        Long employeeId,
        Long userId,
        String employeeNumber,
        String fullName,
        String departmentName,
        String employmentStatus,
        TrainerAuthorizationSource sourceType,
        TrainerAuthorizationStatus status,
        boolean acceptingNewPairings,
        int activeTrainees,
        int pendingTrainees,
        int maxConcurrentTrainees,
        String bio,
        String availabilityNotes,
        List<TrainerSkillDto> skills,
        Instant effectiveFrom,
        Instant updatedAt,
        Integer experienceYears,
        String mentoringApproach,
        Integer sessionsPerWeek,
        Long profilePictureFileId,
        String profilePictureFileName,
        String profileApplicationDetails,
        List<ProfileEvidence> profileApplicationEvidence
) {
    public record ProfileEvidence(Long fileId, String fileName, String context) {
    }
}
