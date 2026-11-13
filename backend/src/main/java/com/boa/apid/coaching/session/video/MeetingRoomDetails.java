package com.boa.apid.coaching.session.video;

import java.time.Instant;

public record MeetingRoomDetails(
        String roomName,
        String roomUrl,
        Instant expiresAt,
        boolean isMock
) {}

