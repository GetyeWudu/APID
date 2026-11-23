package com.boa.apid.platform.video.api;

import java.time.Instant;

public record MeetingRoomDetails(
        String roomName,
        String roomUrl,
        Instant expiresAt,
        String providerName,
        boolean isMock
) {
    public MeetingRoomDetails(String roomName, String roomUrl, Instant expiresAt, boolean isMock) {
        this(roomName, roomUrl, expiresAt, isMock ? "MOCK" : "LIVEKIT", isMock);
    }
}
