package com.boa.apid.core.organization.dto;

import com.boa.apid.core.organization.entity.EmploymentStatus;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record CreateEmployeeRequest(
        Long userId,

        @NotBlank(message = "Employee number is required")
        @Size(max = 60, message = "Employee number must not exceed 60 characters")
        String employeeNumber,

        @NotBlank(message = "Full name is required")
        @Size(max = 200, message = "Full name must not exceed 200 characters")
        String fullName,

        @Email(message = "Email must be a valid email address")
        @Size(max = 200, message = "Email must not exceed 200 characters")
        String email,

        @Size(max = 30, message = "Gender must not exceed 30 characters")
        String gender,

        Long departmentId,

        @Size(max = 150, message = "Job must not exceed 150 characters")
        String job,

        @Size(max = 150, message = "Position must not exceed 150 characters")
        String position,

        Long managerId,

        EmploymentStatus employmentStatus
) {}

