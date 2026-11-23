package com.boa.apid.platform.video.livekit;

import com.boa.apid.platform.video.api.MeetingRoomDetails;
import com.boa.apid.platform.video.api.MeetingTokenDetails;
import com.boa.apid.platform.video.mock.MockVideoMeetingProvider;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.Instant;

import static org.junit.jupiter.api.Assertions.*;

class LiveKitMeetingProviderTest {

    private LiveKitConfigProperties properties;
    private LiveKitTokenService tokenService;
    private MockVideoMeetingProvider mockProvider;
    private LiveKitMeetingProvider meetingProvider;

    @BeforeEach
    void setUp() {
        properties = new LiveKitConfigProperties();
        properties.setApiKey("APIDLocalKey");
        properties.setApiSecret("local-dev-livekit-secret-test-32bytes-min");
        properties.setPublicUrl("wss://apid-livekit.home.arpa");

        tokenService = new LiveKitTokenService(properties);
        mockProvider = new MockVideoMeetingProvider();
        meetingProvider = new LiveKitMeetingProvider(properties, tokenService, mockProvider);
    }

    @Test
    @DisplayName("Creates canonical room name and public WebSocket room URL")
    void testCreateRoom() {
        Instant exp = Instant.now().plusSeconds(3600);
        MeetingRoomDetails room = meetingProvider.createRoom("coaching-77", exp);

        assertNotNull(room);
        assertTrue(room.roomName().startsWith("boa-coaching-77-"));
        assertEquals("wss://apid-livekit.home.arpa/" + room.roomName(), room.roomUrl());
        assertEquals("LIVEKIT", room.providerName());
        assertFalse(room.isMock());
    }

    @Test
    @DisplayName("Creates participant join token with embedded token URL")
    void testCreateParticipantToken() {
        String roomName = "boa-coaching-77-abc12345";
        Instant exp = Instant.now().plusSeconds(3600);
        MeetingTokenDetails tokenDetails = meetingProvider.createParticipantToken(
                roomName, "BOA-EMP-001", "Tigist Alemu", true, exp);

        assertNotNull(tokenDetails);
        assertNotNull(tokenDetails.token());
        assertTrue(tokenDetails.roomUrlWithToken().contains("token=" + tokenDetails.token()));
        assertEquals("LIVEKIT", tokenDetails.providerName());
        assertFalse(tokenDetails.isMock());
    }

    @Test
    @DisplayName("Gracefully delegates to MockVideoMeetingProvider when unconfigured")
    void testFallbackToMockWhenUnconfigured() {
        properties.setApiSecret(""); // unconfigured
        MeetingRoomDetails room = meetingProvider.createRoom("test", Instant.now().plusSeconds(60));
        assertTrue(room.isMock());
        assertEquals("MOCK", room.providerName());
    }
}
