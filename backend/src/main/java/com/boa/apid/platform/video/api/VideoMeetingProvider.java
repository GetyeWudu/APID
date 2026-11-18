package com.boa.apid.platform.video.api;

import java.time.Instant;

public interface VideoMeetingProvider {

    MeetingRoomDetails createRoom(String roomNamePrefix, Instant expiresAt);

    MeetingTokenDetails createParticipantToken(
            String roomName,
            String employeeNumber,
            String fullName,
            boolean isOwner,
            Instant expiresAt
    );

    void deleteRoom(String roomName);

    String getProviderName();
}
