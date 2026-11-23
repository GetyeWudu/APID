package com.boa.apid.platform.video.livekit;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jws;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

class LiveKitTokenServiceTest {

    private LiveKitConfigProperties properties;
    private LiveKitTokenService tokenService;

    @BeforeEach
    void setUp() {
        properties = new LiveKitConfigProperties();
        properties.setApiKey("APIDLocalKey");
        properties.setApiSecret("local-dev-livekit-secret-test-32bytes-min");
        properties.setPublicUrl("wss://apid-livekit.home.arpa");
        properties.setTokenTtlSeconds(3600);

        tokenService = new LiveKitTokenService(properties);
    }

    @Test
    @DisplayName("Generates valid signed LiveKit Access Token with video grants and restricted admin")
    void testCreateTokenValid() {
        String roomName = "boa-coaching-101";
        String empNo = "BOA-EMP-0042";
        String fullName = "Abebe Kebede";
        Instant requestedExp = Instant.now().plusSeconds(1800);

        String jwt = tokenService.createToken(roomName, empNo, fullName, true, requestedExp);

        assertNotNull(jwt);
        assertFalse(jwt.isBlank());

        // Verify token with signing key
        SecretKey key = Keys.hmacShaKeyFor(properties.getApiSecret().getBytes(StandardCharsets.UTF_8));
        Jws<Claims> claimsJws = Jwts.parser()
                .verifyWith(key)
                .build()
                .parseSignedClaims(jwt);

        Claims claims = claimsJws.getPayload();
        assertEquals("APIDLocalKey", claims.getIssuer());
        assertEquals(empNo, claims.getSubject());
        assertEquals(fullName, claims.get("name"));

        // Verify video grant claims
        Object videoClaim = claims.get("video");
        assertNotNull(videoClaim);
        assertTrue(videoClaim instanceof Map);
        Map<?, ?> videoMap = (Map<?, ?>) videoClaim;
        assertEquals(roomName, videoMap.get("room"));
        assertEquals(Boolean.TRUE, videoMap.get("roomJoin"));
        assertEquals(Boolean.TRUE, videoMap.get("canPublish"));
        assertEquals(Boolean.TRUE, videoMap.get("canSubscribe"));
        assertEquals(Boolean.FALSE, videoMap.get("roomAdmin")); // Strictly restricted
    }

    @Test
    @DisplayName("Throws error if secret is not configured")
    void testUnconfiguredSecret() {
        properties.setApiSecret("");
        assertThrows(IllegalStateException.class, () ->
                tokenService.createToken("room", "emp", "name", false, Instant.now().plusSeconds(60)));
    }

    @Test
    @DisplayName("Generates BCrypt password hash for testing")
    void testPasswordHash() {
        org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder encoder =
                new org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder(12);
        String hash = encoder.encode("Password123!");
        System.out.println("GEN_BCRYPT_HASH=" + hash);
        assertTrue(encoder.matches("Password123!", hash));
    }
}
