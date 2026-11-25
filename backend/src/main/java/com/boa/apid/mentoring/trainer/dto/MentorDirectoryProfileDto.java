package com.boa.apid.mentoring.trainer.dto;

import java.util.List;

public record MentorDirectoryProfileDto(
        TrainerDirectoryDto mentor,
        String profileSummary,
        List<Experience> careerExperience,
        List<Experience> mentorshipExperience
) {
    public record Experience(String role, String organization, String years) {
    }
}
