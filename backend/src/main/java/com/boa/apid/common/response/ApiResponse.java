package com.boa.apid.common.response;

import java.time.Instant;

/**
 * Standard envelope for successful APID REST responses.
 */
public record ApiResponse<T>(
        boolean success,
        String message,
        T data,
        Instant timestamp
) {

    public static <T> ApiResponse<T> ok(String message, T data) {
        return new ApiResponse<>(true, message, data, Instant.now());
    }

    public static <T> ApiResponse<T> ok(T data) {
        return ok("Success", data);
    }
}

