package com.boa.apid.mentoring.matching.dto;

import com.boa.apid.core.organization.dto.OrganizationLocationDto;
import com.boa.apid.mentoring.matching.entity.MentoringMatchRequest;
import com.boa.apid.mentoring.matching.entity.MentoringMatchRequestStatus;

import java.time.Instant;
import java.util.List;

public record MentoringMatchRequestDto(
        Long id,
        Long traineeUserId,
        String traineeName,
        String traineeEmployeeNumber,
        String departmentName,
        Long skillId,
        String skillName,
        String message,
        MentoringMatchRequestStatus status,
        Long matchedTrainerUserId,
        String matchedTrainerName,
        Long mentoringRelationshipId,
        Instant createdAt,
        List<OrganizationLocationDto> organizationPath
) {
    public static MentoringMatchRequestDto from(MentoringMatchRequest request, Long relationshipId) {
        return from(
                request,
                relationshipId,
                request.getMatchedTrainer() == null ? null : request.getMatchedTrainer().getUsername()
        );
    }

    public static MentoringMatchRequestDto from(
            MentoringMatchRequest request,
            Long relationshipId,
            String matchedTrainerName
    ) {
        return new MentoringMatchRequestDto(
                request.getId(),
                request.getTraineeEmployee().getUserId(),
                request.getTraineeEmployee().getFullName(),
                request.getTraineeEmployee().getEmployeeNumber(),
                request.getTraineeEmployee().getDepartmentName(),
                request.getSkill().getId(),
                request.getSkill().getName(),
                request.getMessage(),
                request.getStatus(),
                request.getMatchedTrainer() == null ? null : request.getMatchedTrainer().getId(),
                matchedTrainerName,
                relationshipId,
                request.getCreatedAt(),
                OrganizationLocationDto.path(request.getTraineeEmployee())
        );
    }
}
