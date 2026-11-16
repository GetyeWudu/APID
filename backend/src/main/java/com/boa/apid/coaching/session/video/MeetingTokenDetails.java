package com.boa.apid.coaching.session.video;

import java.time.Instant;

public record MeetingTokenDetails(
        String token,
        String roomUrlWithToken,
        Instant expiresAt,
        boolean isMock
) {}

