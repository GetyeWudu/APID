package com.boa.apid.platform.video.api;

import java.time.Instant;

public record MeetingTokenDetails(
        String token,
        String roomUrlWithToken,
        Instant expiresAt,
        String providerName,
        boolean isMock
) {
    public MeetingTokenDetails(String token, String roomUrlWithToken, Instant expiresAt, boolean isMock) {
        this(token, roomUrlWithToken, expiresAt, isMock ? "MOCK" : "LIVEKIT", isMock);
    }
}
