package com.boa.apid.platform.video.livekit;

import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.Date;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

@Service
public class LiveKitTokenService {

    private static final Logger log = LoggerFactory.getLogger(LiveKitTokenService.class);

    private final LiveKitConfigProperties properties;

    public LiveKitTokenService(LiveKitConfigProperties properties) {
        this.properties = properties;
    }

    /**
     * Generates a signed LiveKit Access Token for a participant.
     *
     * @param roomName       the canonical LiveKit room name
     * @param identity       the unique participant identity (e.g. employee number)
     * @param name           the participant display name
     * @param isOwner        whether this participant is the session host/organizer
     * @param requestedExpiry optional requested expiry (clamped to safety max)
     * @return signed JWT token string
     */
    public String createToken(
            String roomName,
            String identity,
            String name,
            boolean isOwner,
            Instant requestedExpiry
    ) {
        if (!properties.isConfigured()) {
            throw new IllegalStateException("LiveKit API Key or Secret is not configured.");
        }

        Instant now = Instant.now();
        Instant expiry = requestedExpiry != null && requestedExpiry.isAfter(now.plusSeconds(60))
                ? requestedExpiry
                : now.plusSeconds(properties.getTokenTtlSeconds());

        // Max token TTL guard (never more than 24 hours)
        Instant maxExpiry = now.plus(Duration.ofHours(24));
        if (expiry.isAfter(maxExpiry)) {
            expiry = maxExpiry;
        }

        // LiveKit video grant claims
        Map<String, Object> videoGrant = new HashMap<>();
        videoGrant.put("room", roomName);
        videoGrant.put("roomJoin", true);
        videoGrant.put("canPublish", true);
        videoGrant.put("canSubscribe", true);
        videoGrant.put("canPublishData", true);
        // Note: Even hosts/owners receive restricted grants without unrestricted server-admin rights
        videoGrant.put("roomAdmin", false);

        // APID participant metadata
        Map<String, Object> metadata = new HashMap<>();
        metadata.put("role", isOwner ? "HOST" : "PARTICIPANT");
        metadata.put("platform", "APID");

        SecretKey signingKey = Keys.hmacShaKeyFor(properties.getApiSecret().getBytes(StandardCharsets.UTF_8));

        return Jwts.builder()
                .id(UUID.randomUUID().toString())
                .issuer(properties.getApiKey())
                .subject(identity)
                .claim("identity", identity)
                .claim("name", name != null && !name.isBlank() ? name : identity)
                .claim("video", videoGrant)
                .claim("metadata", metadata.toString())
                .notBefore(Date.from(now.minusSeconds(10))) // 10s clock skew tolerance
                .issuedAt(Date.from(now))
                .expiration(Date.from(expiry))
                .signWith(signingKey, Jwts.SIG.HS256)
                .compact();
    }
}
