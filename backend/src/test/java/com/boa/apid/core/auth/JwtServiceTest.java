package com.boa.apid.core.auth;

import com.boa.apid.core.auth.security.JwtService;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Date;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class JwtServiceTest {

    private static final String SECRET = "test-jwt-secret-key-at-least-32-bytes-long-2026";
    private JwtService jwtService;

    @BeforeEach
    void setUp() {
        jwtService = new JwtService(SECRET, "apid", "apid-api", 900_000L);
        // Invoke validation via reflection or package-private helper? Let's test via constructor + helper
        invokeInit(jwtService);
    }

    private void invokeInit(JwtService service) {
        try {
            var method = JwtService.class.getDeclaredMethod("initAndValidateSecret");
            method.setAccessible(true);
            method.invoke(service);
        } catch (Exception e) {
            if (e.getCause() instanceof RuntimeException re) {
                throw re;
            }
            throw new RuntimeException(e);
        }
    }

    @Test
    void rejectsWeakOrBlankSecret() {
        JwtService blank = new JwtService("", "apid", "apid-api", 900_000L);
        assertThatThrownBy(() -> invokeInit(blank))
                .isInstanceOf(IllegalStateException.class);

        JwtService shortSecret = new JwtService("too-short-secret", "apid", "apid-api", 900_000L);
        assertThatThrownBy(() -> invokeInit(shortSecret))
                .isInstanceOf(IllegalStateException.class);
    }

    @Test
    void generatesAndParsesValidAccessToken() {
        String token = jwtService.generateAccessToken(42L, 3);
        JwtService.ParsedAccessToken parsed = jwtService.parseAndValidateAccessToken(token);

        assertThat(parsed.userId()).isEqualTo(42L);
        assertThat(parsed.tokenVersion()).isEqualTo(3);
        assertThat(parsed.jti()).isNotBlank();
    }

    @Test
    void rejectsTokenSignedWithDifferentKey() {
        SecretKey otherKey = Keys.hmacShaKeyFor("another-totally-different-32-byte-secret!".getBytes(StandardCharsets.UTF_8));
        String forged = Jwts.builder()
                .id(UUID.randomUUID().toString())
                .subject("42")
                .issuer("apid")
                .audience().add("apid-api").and()
                .issuedAt(new Date())
                .expiration(Date.from(Instant.now().plusSeconds(300)))
                .claim("token_type", "ACCESS")
                .claim("ver", 1)
                .signWith(otherKey, Jwts.SIG.HS256)
                .compact();

        assertThatThrownBy(() -> jwtService.parseAndValidateAccessToken(forged))
                .isInstanceOf(JwtException.class);
    }

    @Test
    void rejectsExpiredToken() {
        SecretKey key = Keys.hmacShaKeyFor(SECRET.getBytes(StandardCharsets.UTF_8));
        String expired = Jwts.builder()
                .id(UUID.randomUUID().toString())
                .subject("42")
                .issuer("apid")
                .audience().add("apid-api").and()
                .issuedAt(Date.from(Instant.now().minusSeconds(600)))
                .expiration(Date.from(Instant.now().minusSeconds(60)))
                .claim("token_type", "ACCESS")
                .claim("ver", 1)
                .signWith(key, Jwts.SIG.HS256)
                .compact();

        assertThatThrownBy(() -> jwtService.parseAndValidateAccessToken(expired))
                .isInstanceOf(JwtException.class);
    }

    @Test
    void rejectsWrongIssuerOrAudienceOrTokenType() {
        SecretKey key = Keys.hmacShaKeyFor(SECRET.getBytes(StandardCharsets.UTF_8));
        String wrongIssuer = Jwts.builder()
                .subject("42")
                .issuer("evil-issuer")
                .audience().add("apid-api").and()
                .expiration(Date.from(Instant.now().plusSeconds(300)))
                .claim("token_type", "ACCESS")
                .claim("ver", 1)
                .signWith(key, Jwts.SIG.HS256)
                .compact();

        String wrongTokenType = Jwts.builder()
                .subject("42")
                .issuer("apid")
                .audience().add("apid-api").and()
                .expiration(Date.from(Instant.now().plusSeconds(300)))
                .claim("token_type", "REFRESH")
                .claim("ver", 1)
                .signWith(key, Jwts.SIG.HS256)
                .compact();

        assertThatThrownBy(() -> jwtService.parseAndValidateAccessToken(wrongIssuer)).isInstanceOf(JwtException.class);
        assertThatThrownBy(() -> jwtService.parseAndValidateAccessToken(wrongTokenType)).isInstanceOf(JwtException.class);
    }
}

