package com.boa.apid.mentoring.trainer.dto;

import com.boa.apid.core.organization.dto.OrganizationLocationDto;

import java.util.List;

public record TrainerEmployeeCandidateDto(
        Long employeeId,
        Long userId,
        String employeeNumber,
        String fullName,
        String departmentName,
        List<OrganizationLocationDto> organizationPath
) {
}
