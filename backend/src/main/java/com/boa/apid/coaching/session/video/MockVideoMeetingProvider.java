package com.boa.apid.coaching.session.video;

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
        String roomName = "mock-boa-" + cleanPrefix + "-" + UUID.randomUUID().toString().substring(0, 8);
        String roomUrl = "https://mock.daily.co/apid-room/" + roomName;
        log.info("[MOCK] Provisioned simulated Daily video room: {}", roomName);
        return new MeetingRoomDetails(roomName, roomUrl, expiresAt, true);
    }

    @Override
    public MeetingTokenDetails createParticipantToken(
            String roomName,
            String employeeNumber,
            String fullName,
            boolean isOwner,
            Instant expiresAt
    ) {
        String mockToken = "mock_token_" + UUID.randomUUID().toString().replace("-", "");
        String urlWithToken = "https://mock.daily.co/apid-room/" + roomName + "?t=" + mockToken;
        log.info("[MOCK] Issued simulated participant meeting token for emp: {}", employeeNumber);
        return new MeetingTokenDetails(mockToken, urlWithToken, expiresAt, true);
    }
}

