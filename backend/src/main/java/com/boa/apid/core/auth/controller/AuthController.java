package com.boa.apid.core.auth.controller;

import com.boa.apid.common.response.ApiResponse;
import com.boa.apid.core.auth.dto.AuthResponse;
import com.boa.apid.core.auth.dto.ChangePasswordRequest;
import com.boa.apid.core.auth.dto.LoginRequest;
import com.boa.apid.core.auth.dto.UserProfileDto;
import com.boa.apid.core.auth.security.ApidUserPrincipal;
import com.boa.apid.core.auth.service.AuthService;
import com.boa.apid.core.auth.service.RefreshTokenService;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseCookie;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.web.csrf.CsrfToken;
import org.springframework.web.bind.annotation.*;

import java.time.Duration;

@RestController
@RequestMapping("/api/v1/core/auth")
public class AuthController {

    public static final String REFRESH_COOKIE_NAME = "apid_refresh_token";
    private static final String REFRESH_COOKIE_PATH = "/api/v1/core/auth";

    private final AuthService authService;
    private final RefreshTokenService refreshTokenService;
    private final boolean cookieSecure;

    public AuthController(
            AuthService authService,
            RefreshTokenService refreshTokenService,
            @Value("${apid.security.cookie-secure:false}") boolean cookieSecure
    ) {
        this.authService = authService;
        this.refreshTokenService = refreshTokenService;
        this.cookieSecure = cookieSecure;
    }

    @GetMapping("/csrf")
    public ApiResponse<String> csrf(CsrfToken csrfToken) {
        // Accessing CsrfToken ensures Spring Security writes the XSRF-TOKEN cookie
        return ApiResponse.ok("CSRF token initialized", csrfToken.getToken());
    }

    @PostMapping("/login")
    public ApiResponse<AuthResponse> login(
            @Valid @RequestBody LoginRequest request,
            HttpServletRequest httpRequest,
            HttpServletResponse httpResponse
    ) {
        AuthService.LoginOutcome outcome = authService.login(
                request,
                resolveClientIp(httpRequest),
                httpRequest.getHeader("User-Agent")
        );
        setRefreshCookie(httpResponse, outcome.rawRefreshToken(),
                Duration.ofMillis(refreshTokenService.getRefreshExpirationMs()));
        return ApiResponse.ok("Login successful", outcome.response());
    }

    @PostMapping("/refresh")
    public ApiResponse<AuthResponse> refresh(
            HttpServletRequest httpRequest,
            HttpServletResponse httpResponse
    ) {
        String rawRefreshToken = extractRefreshCookie(httpRequest);
        AuthService.LoginOutcome outcome = authService.refresh(rawRefreshToken, resolveClientIp(httpRequest));
        setRefreshCookie(httpResponse, outcome.rawRefreshToken(),
                Duration.ofMillis(refreshTokenService.getRefreshExpirationMs()));
        return ApiResponse.ok("Session refreshed", outcome.response());
    }

    @PostMapping("/logout")
    public ApiResponse<Void> logout(
            HttpServletRequest httpRequest,
            HttpServletResponse httpResponse
    ) {
        String rawRefreshToken = extractRefreshCookie(httpRequest);
        authService.logout(rawRefreshToken);
        clearRefreshCookie(httpResponse);
        return ApiResponse.ok("Logged out successfully", null);
    }

    @PostMapping("/change-password")
    public ApiResponse<Void> changePassword(
            @AuthenticationPrincipal ApidUserPrincipal principal,
            @Valid @RequestBody ChangePasswordRequest request,
            HttpServletResponse httpResponse
    ) {
        authService.changePassword(principal.getUserId(), request);
        clearRefreshCookie(httpResponse);
        return ApiResponse.ok("Password changed successfully. Please sign in with your new password.", null);
    }

    @GetMapping("/me")
    public ApiResponse<UserProfileDto> me(@AuthenticationPrincipal ApidUserPrincipal principal) {
        return ApiResponse.ok(authService.getProfile(principal));
    }

    private void setRefreshCookie(HttpServletResponse response, String tokenValue, Duration maxAge) {
        ResponseCookie cookie = ResponseCookie.from(REFRESH_COOKIE_NAME, tokenValue)
                .httpOnly(true)
                .secure(cookieSecure)
                .sameSite("Lax")
                .path(REFRESH_COOKIE_PATH)
                .maxAge(maxAge)
                .build();
        response.addHeader(HttpHeaders.SET_COOKIE, cookie.toString());
    }

    private void clearRefreshCookie(HttpServletResponse response) {
        ResponseCookie cookie = ResponseCookie.from(REFRESH_COOKIE_NAME, "")
                .httpOnly(true)
                .secure(cookieSecure)
                .sameSite("Lax")
                .path(REFRESH_COOKIE_PATH)
                .maxAge(Duration.ZERO)
                .build();
        response.addHeader(HttpHeaders.SET_COOKIE, cookie.toString());
    }

    private String extractRefreshCookie(HttpServletRequest request) {
        Cookie[] cookies = request.getCookies();
        if (cookies == null) {
            return null;
        }
        for (Cookie cookie : cookies) {
            if (REFRESH_COOKIE_NAME.equals(cookie.getName())) {
                return cookie.getValue();
            }
        }
        return null;
    }

    private String resolveClientIp(HttpServletRequest request) {
        String xff = request.getHeader("X-Forwarded-For");
        if (xff != null && !xff.isBlank()) {
            return xff.split(",")[0].trim();
        }
        return request.getRemoteAddr();
    }
}

