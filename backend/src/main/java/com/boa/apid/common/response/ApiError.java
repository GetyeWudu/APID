package com.boa.apid.common.response;

import java.time.Instant;
import java.util.Map;

/**
 * Standard envelope for APID REST error responses.
 */
public record ApiError(
        boolean success,
        String errorCode,
        String message,
        Map<String, String> fieldErrors,
        Instant timestamp
) {

    public static ApiError of(String errorCode, String message) {
        return new ApiError(false, errorCode, message, Map.of(), Instant.now());
    }

    public static ApiError validation(String message, Map<String, String> fieldErrors) {
        return new ApiError(false, "VALIDATION_ERROR", message, fieldErrors, Instant.now());
    }
}

