package com.boa.apid.core.auth.service;

import com.boa.apid.common.exception.BusinessException;
import com.boa.apid.core.auth.entity.RefreshToken;
import com.boa.apid.core.auth.repository.RefreshTokenRepository;
import com.boa.apid.core.authorization.entity.User;
import com.boa.apid.core.authorization.entity.UserStatus;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Instant;
import java.util.Base64;
import java.util.HexFormat;
import java.util.UUID;

/**
 * Manages opaque refresh tokens with family tracking, atomic single-use rotation,
 * reuse detection (family revocation), and full user-session invalidation.
 */
@Service
public class RefreshTokenService {

    private static final Logger log = LoggerFactory.getLogger(RefreshTokenService.class);
    private static final SecureRandom SECURE_RANDOM = new SecureRandom();

    private final RefreshTokenRepository refreshTokenRepository;
    private final long refreshExpirationMs;

    public RefreshTokenService(
            RefreshTokenRepository refreshTokenRepository,
            @Value("${apid.jwt.refresh-expiration-ms}") long refreshExpirationMs
    ) {
        this.refreshTokenRepository = refreshTokenRepository;
        this.refreshExpirationMs = refreshExpirationMs;
    }

    @Transactional
    public String issueInitialToken(User user) {
        UUID familyId = UUID.randomUUID();
        return createTokenInFamily(user, familyId).rawToken();
    }

    /**
     * Atomically rotates a valid refresh token.
     * Detects token reuse or concurrent race conditions and revokes the entire token family immediately.
     */
    @Transactional(noRollbackFor = BusinessException.class)
    public RotationResult rotateToken(String rawToken) {
        if (rawToken == null || rawToken.isBlank()) {
            throw unauthorized("Invalid refresh token");
        }

        String hash = sha256Hex(rawToken);
        RefreshToken existing = refreshTokenRepository.findByTokenHashWithUser(hash)
                .orElseThrow(() -> unauthorized("Invalid refresh token"));

        Instant now = Instant.now();

        if (existing.isRevoked()) {
            // Potential token theft / replay: revoke all tokens in this family immediately
            log.warn("Refresh token reuse detected for userId={} familyId={}",
                    existing.getUser().getId(), existing.getFamilyId());
            refreshTokenRepository.revokeFamily(existing.getFamilyId(), "REUSE_DETECTED", now);
            throw unauthorized("Session expired or revoked. Please sign in again.");
        }

        if (existing.getExpiresAt().isBefore(now)) {
            throw unauthorized("Refresh token expired");
        }

        User user = existing.getUser();
        if (user.getStatus() != UserStatus.ACTIVE ||
                (user.getLockedUntil() != null && user.getLockedUntil().isAfter(now))) {
            refreshTokenRepository.revokeFamily(existing.getFamilyId(), "ACCOUNT_INACTIVE", now);
            throw unauthorized("Account is not active");
        }

        // Create successor token in the same family first so we have its ID for replacement tracking
        IssuedToken next = createTokenInFamily(user, existing.getFamilyId());

        // Atomic conditional update: fails if another concurrent request rotated this token first
        int updated = refreshTokenRepository.markRotatedAtomically(existing.getId(), next.entity().getId(), now);
        if (updated != 1) {
            log.warn("Concurrent refresh rotation race detected for userId={} familyId={}",
                    user.getId(), existing.getFamilyId());
            refreshTokenRepository.revokeFamily(existing.getFamilyId(), "REUSE_DETECTED", now);
            throw unauthorized("Session conflict detected. Please sign in again.");
        }

        return new RotationResult(user, next.rawToken());
    }

    @Transactional
    public void revokeByRawToken(String rawToken, String reason) {
        if (rawToken == null || rawToken.isBlank()) {
            return;
        }
        String hash = sha256Hex(rawToken);
        refreshTokenRepository.findByTokenHashWithUser(hash).ifPresent(token ->
                refreshTokenRepository.revokeFamily(token.getFamilyId(), reason, Instant.now())
        );
    }

    @Transactional
    public void revokeAllUserTokens(Long userId, String reason) {
        refreshTokenRepository.revokeAllByUserId(userId, reason, Instant.now());
    }

    public long getRefreshExpirationMs() {
        return refreshExpirationMs;
    }

    private IssuedToken createTokenInFamily(User user, UUID familyId) {
        byte[] randomBytes = new byte[48];
        SECURE_RANDOM.nextBytes(randomBytes);
        String raw = Base64.getUrlEncoder().withoutPadding().encodeToString(randomBytes);

        RefreshToken entity = new RefreshToken();
        entity.setUser(user);
        entity.setFamilyId(familyId);
        entity.setTokenHash(sha256Hex(raw));
        entity.setExpiresAt(Instant.now().plusMillis(refreshExpirationMs));
        RefreshToken saved = refreshTokenRepository.save(entity);
        return new IssuedToken(raw, saved);
    }

    public static String sha256Hex(String value) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(value.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(hash);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 unavailable", e);
        }
    }

    private BusinessException unauthorized(String message) {
        return new BusinessException("UNAUTHORIZED", message, HttpStatus.UNAUTHORIZED);
    }

    private record IssuedToken(String rawToken, RefreshToken entity) {}

    public record RotationResult(User user, String newRawRefreshToken) {}
}

