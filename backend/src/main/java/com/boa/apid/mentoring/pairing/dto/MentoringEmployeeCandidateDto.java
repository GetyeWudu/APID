package com.boa.apid.mentoring.pairing.dto;

public record MentoringEmployeeCandidateDto(
        Long userId,
        String employeeNumber,
        String fullName,
        String departmentName
) {
}
