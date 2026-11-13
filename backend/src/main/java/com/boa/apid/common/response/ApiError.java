package com.boa.apid.common.response;

import java.time.Instant;
import java.util.Map;

/**
 * Standard envelope for APID REST error responses.
 *
 * JSON shape:
 * <pre>
 * {
 *   "success": false,
 *   "error": {
 *     "code": "SOME_ERROR_CODE",
 *     "message": "Human-readable description",
 *     "fieldErrors": {}
 *   },
 *   "timestamp": "..."
 * }
 * </pre>
 */
public record ApiError(
        boolean success,
        ErrorDetail error,
        Instant timestamp
) {

    public record ErrorDetail(
            String code,
            String message,
            Map<String, String> fieldErrors
    ) {}

    public static ApiError of(String code, String message) {
        return new ApiError(false, new ErrorDetail(code, message, Map.of()), Instant.now());
    }

    public static ApiError validation(String message, Map<String, String> fieldErrors) {
        return new ApiError(false, new ErrorDetail("VALIDATION_ERROR", message, fieldErrors), Instant.now());
    }
}
