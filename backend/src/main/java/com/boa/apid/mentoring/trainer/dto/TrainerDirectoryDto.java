package com.boa.apid.mentoring.trainer.dto;

import java.util.List;

public record TrainerDirectoryDto(
        Long userId,
        String username,
        String employeeNumber,
        String fullName,
        String departmentName,
        String bio,
        String availabilityNotes,
        int activeTrainees,
        int remainingCapacity,
        Double averageRating,
        List<TrainerSkillDto> skills,
        Integer experienceYears,
        String mentoringApproach,
        Integer sessionsPerWeek,
        List<EducationProfile> education,
        List<ProfessionalCertificate> professionalCertificates
) {
    public record EducationProfile(
            String educationLevel,
            String fieldOfStudy,
            String institution
    ) {
    }

    public record ProfessionalCertificate(
            String title,
            List<String> skills
    ) {
    }
}
