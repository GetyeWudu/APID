package com.boa.apid.mentoring.trainer.dto;

public record TrainerEmployeeCandidateDto(
        Long employeeId,
        Long userId,
        String employeeNumber,
        String fullName,
        String departmentName
) {
}
