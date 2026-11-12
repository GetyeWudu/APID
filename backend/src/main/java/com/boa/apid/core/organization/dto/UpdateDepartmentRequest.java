package com.boa.apid.core.organization.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record UpdateDepartmentRequest(
        @Size(max = 60, message = "Department code must not exceed 60 characters")
        String code,

        @NotBlank(message = "Department name is required")
        @Size(max = 150, message = "Department name must not exceed 150 characters")
        String name,

        Long parentDepartmentId,

        Long headEmployeeId,

        @NotNull(message = "Active status is required")
        Boolean active
) {}

