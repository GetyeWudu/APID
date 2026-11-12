package com.boa.apid.core.organization.dto;

import com.boa.apid.core.authorization.entity.UserStatus;

public record UserAccountSummaryDto(
        Long id,
        String username,
        UserStatus status
) {}

