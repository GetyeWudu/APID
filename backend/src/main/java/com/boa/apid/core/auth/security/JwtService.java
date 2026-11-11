package com.boa.apid.core.auth.security;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jws;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import jakarta.annotation.PostConstruct;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Date;
import java.util.UUID;

/**
 * Issues and strictly validates short-lived HS256 access tokens with explicit algorithm,
 * issuer, audience, token_type, subject (immutable userId), jti, and token version claims.
 */
@Service
public class JwtService {

    public static final String CLAIM_TOKEN_TYPE = "token_type";
    public static final String CLAIM_TOKEN_VERSION = "ver";
    public static final String TOKEN_TYPE_ACCESS = "ACCESS";

    private final String rawSecret;
    private final String issuer;
    private final String audience;
    private final long accessExpirationMs;
    private SecretKey signingKey;

    public JwtService(
            @Value("${apid.jwt.secret}") String rawSecret,
            @Value("${apid.jwt.issuer}") String issuer,
            @Value("${apid.jwt.audience}") String audience,
            @Value("${apid.jwt.expiration-ms}") long accessExpirationMs
    ) {
        this.rawSecret = rawSecret;
        this.issuer = issuer;
        this.audience = audience;
        this.accessExpirationMs = accessExpirationMs;
    }

    @PostConstruct
    void initAndValidateSecret() {
        if (rawSecret == null || rawSecret.isBlank()) {
            throw new IllegalStateException("JWT_SECRET must be configured and non-empty");
        }
        byte[] keyBytes = rawSecret.getBytes(StandardCharsets.UTF_8);
        if (keyBytes.length < 32) {
            throw new IllegalStateException("JWT_SECRET must be at least 32 bytes (256 bits) for HS256");
        }
        this.signingKey = Keys.hmacShaKeyFor(keyBytes);
    }

    public String generateAccessToken(Long userId, int tokenVersion) {
        Instant now = Instant.now();
        Instant expiry = now.plusMillis(accessExpirationMs);

        return Jwts.builder()
                .id(UUID.randomUUID().toString())
                .subject(String.valueOf(userId))
                .issuer(issuer)
                .audience().add(audience).and()
                .issuedAt(Date.from(now))
                .expiration(Date.from(expiry))
                .claim(CLAIM_TOKEN_TYPE, TOKEN_TYPE_ACCESS)
                .claim(CLAIM_TOKEN_VERSION, tokenVersion)
                .signWith(signingKey, Jwts.SIG.HS256)
                .compact();
    }

    public ParsedAccessToken parseAndValidateAccessToken(String token) {
        Jws<Claims> jws = Jwts.parser()
                .verifyWith(signingKey)
                .requireIssuer(issuer)
                .requireAudience(audience)
                .build()
                .parseSignedClaims(token);

        // Explicitly reject any algorithm other than HS256
        String alg = jws.getHeader().getAlgorithm();
        if (!"HS256".equals(alg)) {
            throw new JwtException("Unsupported JWT algorithm: " + alg);
        }

        Claims claims = jws.getPayload();
        String tokenType = claims.get(CLAIM_TOKEN_TYPE, String.class);
        if (!TOKEN_TYPE_ACCESS.equals(tokenType)) {
            throw new JwtException("Invalid token_type claim");
        }

        String subject = claims.getSubject();
        if (subject == null || subject.isBlank()) {
            throw new JwtException("Missing subject claim");
        }

        Number version = claims.get(CLAIM_TOKEN_VERSION, Number.class);
        if (version == null) {
            throw new JwtException("Missing token version claim");
        }

        try {
            return new ParsedAccessToken(
                    Long.parseLong(subject),
                    version.intValue(),
                    claims.getId()
            );
        } catch (NumberFormatException ex) {
            throw new JwtException("Invalid subject format", ex);
        }
    }

    public long getAccessExpirationMs() {
        return accessExpirationMs;
    }

    public record ParsedAccessToken(Long userId, int tokenVersion, String jti) {}
}

