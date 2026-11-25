package com.boa.apid.mentoring.ai.recommendation.dto;

import com.boa.apid.mentoring.ai.recommendation.service.MentorRecommendationContextService.ExperienceContext;
import com.boa.apid.mentoring.trainer.dto.TrainerDirectoryDto;

import java.util.List;

public record MentorRecommendationDto(
        int rank,
        String reason,
        Long skillId,
        String skillName,
        String profileSummary,
        List<ExperienceContext> careerExperience,
        List<ExperienceContext> mentorshipExperience,
        TrainerDirectoryDto mentor
) {
}
