package com.boa.apid.common;

import com.boa.apid.common.response.ApiError;
import com.boa.apid.common.response.ApiResponse;
import org.junit.jupiter.api.Test;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

class ApiResponseTest {

    @Test
    void okResponseWrapsDataAndTimestamp() {
        ApiResponse<String> response = ApiResponse.ok("Loaded", "hello");
        assertTrue(response.success());
        assertEquals("Loaded", response.message());
        assertEquals("hello", response.data());
        assertNotNull(response.timestamp());
    }

    @Test
    void validationErrorIncludesFieldErrors() {
        ApiError error = ApiError.validation("Invalid", Map.of("email", "must not be blank"));
        assertFalse(error.success());
        assertEquals("VALIDATION_ERROR", error.errorCode());
        assertEquals("must not be blank", error.fieldErrors().get("email"));
        assertNotNull(error.timestamp());
    }
}

