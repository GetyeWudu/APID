package com.boa.apid.platform.video.livekit;

import com.boa.apid.platform.video.api.MeetingRoomDetails;
import com.boa.apid.platform.video.api.MeetingTokenDetails;
import com.boa.apid.platform.video.api.VideoMeetingProvider;
import com.boa.apid.platform.video.mock.MockVideoMeetingProvider;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Primary;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.UUID;

@Service
@Primary
public class LiveKitMeetingProvider implements VideoMeetingProvider {

    private static final Logger log = LoggerFactory.getLogger(LiveKitMeetingProvider.class);

    private final LiveKitConfigProperties properties;
    private final LiveKitTokenService tokenService;
    private final MockVideoMeetingProvider mockProvider;

    public LiveKitMeetingProvider(
            LiveKitConfigProperties properties,
            LiveKitTokenService tokenService,
            MockVideoMeetingProvider mockProvider
    ) {
        this.properties = properties;
        this.tokenService = tokenService;
        this.mockProvider = mockProvider;
    }

    @Override
    public MeetingRoomDetails createRoom(String roomNamePrefix, Instant expiresAt) {
        if (!properties.isConfigured()) {
            log.info("LiveKit credentials not configured. Delegating to MockVideoMeetingProvider.");
            return mockProvider.createRoom(roomNamePrefix, expiresAt);
        }

        String cleanPrefix = roomNamePrefix != null
                ? roomNamePrefix.replaceAll("[^a-zA-Z0-9_-]", "").toLowerCase()
                : "session";
        String roomName = ("boa-" + cleanPrefix + "-" + UUID.randomUUID().toString().substring(0, 8)).toLowerCase();

        String basePublicUrl = properties.getPublicUrl().replaceAll("/+$", "");
        String roomUrl = basePublicUrl + "/" + roomName;

        log.info("Provisioned LiveKit room: {} (public URL: {}, expires: {})", roomName, roomUrl, expiresAt);
        return new MeetingRoomDetails(roomName, roomUrl, expiresAt, "LIVEKIT", false);
    }

    @Override
    public MeetingTokenDetails createParticipantToken(
            String roomName,
            String employeeNumber,
            String fullName,
            boolean isOwner,
            Instant expiresAt
    ) {
        if (!properties.isConfigured()) {
            return mockProvider.createParticipantToken(roomName, employeeNumber, fullName, isOwner, expiresAt);
        }

        String token = tokenService.createToken(roomName, employeeNumber, fullName, isOwner, expiresAt);
        String basePublicUrl = properties.getPublicUrl().replaceAll("/+$", "");
        String roomUrlWithToken = basePublicUrl + "/" + roomName + "?token=" + token;

        log.info("Generated LiveKit participant token for emp={}, room={}, isOwner={}", employeeNumber, roomName, isOwner);
        return new MeetingTokenDetails(token, roomUrlWithToken, expiresAt, "LIVEKIT", false);
    }

    @Override
    public void deleteRoom(String roomName) {
        if (!properties.isConfigured()) {
            mockProvider.deleteRoom(roomName);
            return;
        }
        log.info("Closing LiveKit room: {}", roomName);
        // Note: LiveKit rooms close automatically when all participants disconnect and token expires.
    }

    @Override
    public String getProviderName() {
        return "LIVEKIT";
    }
}
