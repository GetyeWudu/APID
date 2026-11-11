package com.boa.apid.core.audit;

import com.boa.apid.common.response.ApiResponse;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

/**
 * Basic Phase 1 verification endpoint for backend and frontend connectivity checks.
 */
@RestController
@RequestMapping("/api/v1/core")
public class SystemHealthController {

    @GetMapping("/health")
    public ApiResponse<Map<String, Object>> health() {
        return ApiResponse.ok("APID backend is running", Map.of(
                "service", "apid-backend",
                "status", "UP",
                "modules", new String[]{"core", "coaching", "mentoring"}
        ));
    }
}

