package com.boa.apid.core.organization.dto;

public record CreateAndLinkEmployeeUserResponse(
        EmployeeDto employee,
        String username,
        String temporaryPassword
) {}
