package com.boa.apid.core.auth.service;

import com.boa.apid.common.exception.BusinessException;
import com.boa.apid.common.exception.ResourceNotFoundException;
import com.boa.apid.core.auth.dto.AuthResponse;
import com.boa.apid.core.auth.dto.ChangePasswordRequest;
import com.boa.apid.core.auth.dto.LoginRequest;
import com.boa.apid.core.auth.dto.UserProfileDto;
import com.boa.apid.core.auth.security.ApidUserPrincipal;
import com.boa.apid.core.auth.security.JwtService;
import com.boa.apid.core.audit.service.AuditService;
import com.boa.apid.core.authorization.entity.AuthProvider;
import com.boa.apid.core.authorization.entity.User;
import com.boa.apid.core.authorization.repository.UserRepository;
import com.boa.apid.core.authorization.service.UserAuthorityService;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Set;

@Service
public class AuthService {

    private static final String GENERIC_LOGIN_ERROR = "Invalid username or password";

    private final List<IdentityAuthenticationProvider> authProviders;
    private final LoginRateLimiter rateLimiter;
    private final JwtService jwtService;
    private final RefreshTokenService refreshTokenService;
    private final UserAuthorityService userAuthorityService;
    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final AuditService auditService;

    public AuthService(
            List<IdentityAuthenticationProvider> authProviders,
            LoginRateLimiter rateLimiter,
            JwtService jwtService,
            RefreshTokenService refreshTokenService,
            UserAuthorityService userAuthorityService,
            UserRepository userRepository,
            PasswordEncoder passwordEncoder,
            AuditService auditService
    ) {
        this.authProviders = authProviders;
        this.rateLimiter = rateLimiter;
        this.jwtService = jwtService;
        this.refreshTokenService = refreshTokenService;
        this.userAuthorityService = userAuthorityService;
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.auditService = auditService;
    }

    public LoginOutcome login(LoginRequest request, String clientIp, String userAgent) {
        rateLimiter.checkLoginAllowed(clientIp, request.username());

        IdentityAuthenticationProvider provider = authProviders.stream()
                .filter(p -> p.supports(AuthProvider.LOCAL))
                .findFirst()
                .orElseThrow(() -> new IllegalStateException("No LOCAL authentication provider configured"));

        IdentityAuthenticationProvider.AuthResult result = provider.authenticate(request.username(), request.password());
        if (!result.authenticated() || result.user() == null) {
            auditService.recordIndependent(new AuditService.AuditCommand(
                    null, null, request.username(), null,
                    "AUTH", "LOGIN_FAILED", "FAILURE",
                    result.failureReason() != null ? result.failureReason().name() : "UNKNOWN",
                    "USER", null, null, clientIp, userAgent
            ));
            // Generic error message prevents account enumeration
            throw new BusinessException("INVALID_CREDENTIALS", GENERIC_LOGIN_ERROR, HttpStatus.UNAUTHORIZED);
        }

        User user = result.user();
        auditService.record(new AuditService.AuditCommand(
                null, user.getId(), user.getUsername(), user.getId(),
                "AUTH", "LOGIN_SUCCESS", "SUCCESS", null,
                "USER", String.valueOf(user.getId()), null, clientIp, userAgent
        ));

        String accessToken = jwtService.generateAccessToken(user.getId(), user.getTokenVersion());
        String rawRefreshToken = refreshTokenService.issueInitialToken(user);

        return new LoginOutcome(
                buildAuthResponse(user, accessToken),
                rawRefreshToken
        );
    }

    public LoginOutcome refresh(String rawRefreshToken, String clientIp) {
        rateLimiter.checkRefreshAllowed(clientIp);

        RefreshTokenService.RotationResult rotated = refreshTokenService.rotateToken(rawRefreshToken);
        User user = rotated.user();
        String accessToken = jwtService.generateAccessToken(user.getId(), user.getTokenVersion());

        return new LoginOutcome(
                buildAuthResponse(user, accessToken),
                rotated.newRawRefreshToken()
        );
    }

    public void logout(String rawRefreshToken) {
        refreshTokenService.revokeByRawToken(rawRefreshToken, "LOGOUT");
    }

    /**
     * Changes the user's password, clears mustChangePassword, increments tokenVersion,
     * and revokes all active refresh tokens to force immediate reauthentication.
     */
    @Transactional
    public void changePassword(Long userId, ChangePasswordRequest request) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));

        if (user.getPasswordHash() == null || !passwordEncoder.matches(request.currentPassword(), user.getPasswordHash())) {
            throw new BusinessException("INVALID_CURRENT_PASSWORD", "Current password is incorrect", HttpStatus.BAD_REQUEST);
        }
        if (request.currentPassword().equals(request.newPassword())) {
            throw new BusinessException("PASSWORD_REUSE", "New password must differ from current password", HttpStatus.BAD_REQUEST);
        }

        user.setPasswordHash(passwordEncoder.encode(request.newPassword()));
        user.setMustChangePassword(false);
        user.setTokenVersion(user.getTokenVersion() + 1);
        userRepository.save(user);

        refreshTokenService.revokeAllUserTokens(user.getId(), "PASSWORD_CHANGE");
        auditService.record(new AuditService.AuditCommand(
                null, user.getId(), user.getUsername(), user.getId(),
                "AUTH", "PASSWORD_CHANGED", "SUCCESS", null,
                "USER", String.valueOf(user.getId()), null, null, null
        ));
    }

    @Transactional(readOnly = true)
    public UserProfileDto getProfile(ApidUserPrincipal principal) {
        return new UserProfileDto(
                principal.getUserId(),
                principal.getUsername(),
                principal.isMustChangePassword(),
                principal.getRoles(),
                principal.getPermissions()
        );
    }

    private AuthResponse buildAuthResponse(User user, String accessToken) {
        Set<String> roles = userAuthorityService.getActiveRoles(user.getId());
        Set<String> permissions = user.isMustChangePassword()
                ? Set.of()
                : userAuthorityService.getActivePermissions(user.getId());

        UserProfileDto profile = new UserProfileDto(
                user.getId(),
                user.getUsername(),
                user.isMustChangePassword(),
                roles,
                permissions
        );

        return new AuthResponse(
                accessToken,
                "Bearer",
                jwtService.getAccessExpirationMs(),
                profile
        );
    }

    public record LoginOutcome(AuthResponse response, String rawRefreshToken) {}
}

