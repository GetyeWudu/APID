package com.boa.apid.platform.video.mock;

import com.boa.apid.platform.video.api.MeetingRoomDetails;
import com.boa.apid.platform.video.api.MeetingTokenDetails;
import com.boa.apid.platform.video.api.VideoMeetingProvider;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.UUID;

@Component
public class MockVideoMeetingProvider implements VideoMeetingProvider {

    private static final Logger log = LoggerFactory.getLogger(MockVideoMeetingProvider.class);

    @Override
    public MeetingRoomDetails createRoom(String roomNamePrefix, Instant expiresAt) {
        String cleanPrefix = roomNamePrefix != null ? roomNamePrefix.replaceAll("[^a-zA-Z0-9_-]", "") : "session";
        String roomName = "mock-" + cleanPrefix + "-" + UUID.randomUUID().toString().substring(0, 8);
        String roomUrl = "https://mock.livekit.local/" + roomName;
        log.info("Provisioned MOCK video room: {} (expires: {})", roomName, expiresAt);
        return new MeetingRoomDetails(roomName, roomUrl, expiresAt, "MOCK", true);
    }

    @Override
    public MeetingTokenDetails createParticipantToken(
            String roomName,
            String employeeNumber,
            String fullName,
            boolean isOwner,
            Instant expiresAt
    ) {
        String token = "mock-jwt-token-" + UUID.randomUUID() + "-" + employeeNumber;
        String roomUrlWithToken = "https://mock.livekit.local/" + roomName + "?token=" + token;
        log.info("Generated MOCK participant token for emp={}, room={}, isOwner={}", employeeNumber, roomName, isOwner);
        return new MeetingTokenDetails(token, roomUrlWithToken, expiresAt, "MOCK", true);
    }

    @Override
    public void deleteRoom(String roomName) {
        log.info("Deleted MOCK video room: {}", roomName);
    }

    @Override
    public String getProviderName() {
        return "MOCK";
    }
}
