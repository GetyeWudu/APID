package com.boa.apid.platform.video.api;

import java.time.Instant;

public record SessionJoinTokenDto(
        String roomName,
        String token,
        String roomUrlWithToken,
        Instant expiresAt,
        String providerName,
        boolean isMock
) {
    public SessionJoinTokenDto(String roomName, String token, String roomUrlWithToken, Instant expiresAt, boolean isMock) {
        this(roomName, token, roomUrlWithToken, expiresAt, isMock ? "MOCK" : "LIVEKIT", isMock);
    }
}
