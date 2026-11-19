package com.boa.apid.mentoring.ai.recommendation.dto;

import com.boa.apid.mentoring.trainer.dto.TrainerDirectoryDto;

public record MentorRecommendationDto(
        int rank,
        String reason,
        Long skillId,
        String skillName,
        TrainerDirectoryDto mentor
) {
}
