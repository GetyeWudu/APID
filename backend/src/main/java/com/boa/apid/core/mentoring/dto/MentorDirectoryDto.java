package com.boa.apid.core.mentoring.dto;

import java.util.List;

public record MentorDirectoryDto(
        Long userId,
        String username,
        String employeeNumber,
        String fullName,
        String departmentName,
        List<MentorSkillDto> skills
) {
    public record MentorSkillDto(Long id, String name, String category) {
    }
}
