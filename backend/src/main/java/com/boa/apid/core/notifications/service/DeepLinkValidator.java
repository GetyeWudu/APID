package com.boa.apid.core.notifications.service;

import com.boa.apid.common.exception.BusinessException;
import org.springframework.http.HttpStatus;

import java.util.List;
import java.util.Locale;

/**
 * Prevents open-redirect / phishing URLs inside notification deep_link targets.
 * Only relative internal application routes are permitted.
 */
public final class DeepLinkValidator {

    private static final List<String> ALLOWED_PREFIXES = List.of(
            "/admin",
            "/coaching",
            "/mentoring",
            "/workspace"
    );

    private DeepLinkValidator() {
    }

    public static String validateAndNormalize(String rawDeepLink) {
        if (rawDeepLink == null || rawDeepLink.isBlank()) {
            return null;
        }
        String trimmed = rawDeepLink.trim();
        if (trimmed.length() > 300) {
            throw new BusinessException("INVALID_DEEP_LINK", "Deep link exceeds 300 characters", HttpStatus.BAD_REQUEST);
        }
        String lower = trimmed.toLowerCase(Locale.ROOT);
        if (trimmed.startsWith("//")
                || lower.contains("://")
                || lower.startsWith("javascript:")
                || lower.startsWith("data:")
                || trimmed.contains("..")
                || trimmed.chars().anyMatch(ch -> ch < 0x20 || ch == 0x7F)) {
            throw new BusinessException("INVALID_DEEP_LINK",
                    "Notification deep link must be a valid internal portal route",
                    HttpStatus.BAD_REQUEST);
        }

        boolean allowedPrefix = ALLOWED_PREFIXES.stream()
                .anyMatch(prefix -> trimmed.equals(prefix)
                        || trimmed.startsWith(prefix + "/")
                        || trimmed.startsWith(prefix + "?")
                        || trimmed.startsWith(prefix + "#"));
        if (!allowedPrefix) {
            throw new BusinessException("INVALID_DEEP_LINK",
                    "Notification deep link must target an approved portal route",
                    HttpStatus.BAD_REQUEST);
        }
        return trimmed;
    }
}

