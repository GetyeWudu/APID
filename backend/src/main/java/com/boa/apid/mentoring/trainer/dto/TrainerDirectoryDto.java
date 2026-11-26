package com.boa.apid.mentoring.trainer.dto;

import com.boa.apid.core.organization.dto.OrganizationLocationDto;

import java.util.List;

public record TrainerDirectoryDto(
        Long userId,
        String username,
        String employeeNumber,
        String fullName,
        String departmentName,
        String bio,
        int activeTrainees,
        int remainingCapacity,
        Double averageRating,
        List<TrainerSkillDto> skills,
        Integer experienceYears,
        String mentoringApproach,
        Integer sessionsPerWeek,
        List<EducationProfile> education,
        List<ProfessionalCertificate> professionalCertificates,
        List<OrganizationLocationDto> organizationPath,
        Long profilePictureFileId
) {
    public TrainerDirectoryDto(
            Long userId,
            String username,
            String employeeNumber,
            String fullName,
            String departmentName,
            String bio,
            int activeTrainees,
            int remainingCapacity,
            Double averageRating,
            List<TrainerSkillDto> skills,
            Integer experienceYears,
            String mentoringApproach,
            Integer sessionsPerWeek,
            List<EducationProfile> education,
            List<ProfessionalCertificate> professionalCertificates,
            List<OrganizationLocationDto> organizationPath
    ) {
        this(
                userId,
                username,
                employeeNumber,
                fullName,
                departmentName,
                bio,
                activeTrainees,
                remainingCapacity,
                averageRating,
                skills,
                experienceYears,
                mentoringApproach,
                sessionsPerWeek,
                education,
                professionalCertificates,
                organizationPath,
                null
        );
    }

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
