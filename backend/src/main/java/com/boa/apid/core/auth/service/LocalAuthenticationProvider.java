package com.boa.apid.core.auth.service;

import com.boa.apid.core.authorization.entity.AuthProvider;
import com.boa.apid.core.authorization.entity.User;
import com.boa.apid.core.authorization.entity.UserStatus;
import com.boa.apid.core.authorization.repository.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;
import java.util.Locale;
import java.util.Optional;

/**
 * Local BCrypt password authentication with concurrency-safe failed-login tracking,
 * a 15-minute observation window, and a 15-minute temporary account lockout.
 */
@Service
public class LocalAuthenticationProvider implements IdentityAuthenticationProvider {

    private static final Logger log = LoggerFactory.getLogger(LocalAuthenticationProvider.class);

    public static final int MAX_FAILED_ATTEMPTS = 5;
    public static final Duration OBSERVATION_WINDOW = Duration.ofMinutes(15);
    public static final Duration LOCKOUT_DURATION = Duration.ofMinutes(15);

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    public LocalAuthenticationProvider(UserRepository userRepository, PasswordEncoder passwordEncoder) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
    }

    @Override
    public boolean supports(AuthProvider provider) {
        return provider == AuthProvider.LOCAL;
    }

    @Override
    @Transactional
    public AuthResult authenticate(String username, String rawPassword) {
        if (username == null || username.isBlank() || rawPassword == null || rawPassword.isBlank()) {
            return AuthResult.failure(AuthFailureReason.INVALID_PASSWORD);
        }

        String normalized = username.trim().toLowerCase(Locale.ROOT);
        Optional<User> optUser = userRepository.findByUsernameLowerForUpdate(normalized);
        if (optUser.isEmpty()) {
            log.warn("Failed login attempt for unknown username");
            return AuthResult.failure(AuthFailureReason.UNKNOWN_USER);
        }

        User user = optUser.get();
        Instant now = Instant.now();

        if (user.getStatus() == UserStatus.DISABLED) {
            log.warn("Login blocked for DISABLED userId={}", user.getId());
            return AuthResult.failure(AuthFailureReason.ACCOUNT_DISABLED);
        }
        if (user.getStatus() == UserStatus.ADMIN_LOCKED) {
            log.warn("Login blocked for ADMIN_LOCKED userId={}", user.getId());
            return AuthResult.failure(AuthFailureReason.ACCOUNT_ADMIN_LOCKED);
        }
        if (user.getAuthProvider() != AuthProvider.LOCAL) {
            log.warn("Provider mismatch for userId={}", user.getId());
            return AuthResult.failure(AuthFailureReason.PROVIDER_MISMATCH);
        }
        if (user.getLockedUntil() != null && user.getLockedUntil().isAfter(now)) {
            log.warn("Login blocked for temporarily locked userId={} until={}", user.getId(), user.getLockedUntil());
            return AuthResult.failure(AuthFailureReason.ACCOUNT_TEMP_LOCKED);
        }

        // Verify BCrypt password
        if (user.getPasswordHash() == null || !passwordEncoder.matches(rawPassword, user.getPasswordHash())) {
            recordFailedAttempt(user, now);
            return AuthResult.failure(AuthFailureReason.INVALID_PASSWORD);
        }

        // Clear transient counters on success
        user.setFailedLoginAttempts(0);
        user.setFirstFailedLoginAt(null);
        user.setLockedUntil(null);
        user.setLastLoginAt(now);
        userRepository.save(user);

        return AuthResult.success(user);
    }

    private void recordFailedAttempt(User user, Instant now) {
        Instant windowStart = user.getFirstFailedLoginAt();
        if (windowStart == null || windowStart.plus(OBSERVATION_WINDOW).isBefore(now)) {
            // Start a fresh observation window
            user.setFirstFailedLoginAt(now);
            user.setFailedLoginAttempts(1);
            user.setLockedUntil(null);
        } else {
            int attempts = user.getFailedLoginAttempts() + 1;
            user.setFailedLoginAttempts(attempts);
            if (attempts >= MAX_FAILED_ATTEMPTS) {
                user.setLockedUntil(now.plus(LOCKOUT_DURATION));
                log.warn("Account userId={} temporarily locked for {}m after {} failed attempts in window",
                        user.getId(), LOCKOUT_DURATION.toMinutes(), attempts);
            }
        }
        userRepository.save(user);
    }
}

