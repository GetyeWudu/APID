package com.boa.apid.coaching.session.dto;

import java.time.Instant;

public record SessionJoinTokenDto(
        String roomName,
        String token,
        String roomUrlWithToken,
        Instant expiresAt,
        boolean isMock
) {}

