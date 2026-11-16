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
        double averageRating,
        List<TrainerSkillDto> skills
) {
}
