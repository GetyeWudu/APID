package com.boa.apid.core.authorization.controller;

import com.boa.apid.common.response.ApiResponse;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

/**
 * Lightweight RBAC verification endpoint for Phase 1.
 * Full User & Role management endpoints arrive in Phase 2.
 */
@RestController
@RequestMapping("/api/v1/core/admin")
public class AdminPingController {

    @GetMapping("/ping")
    @PreAuthorize("hasAuthority('USER_MANAGE')")
    public ApiResponse<Map<String, String>> ping() {
        return ApiResponse.ok(Map.of("status", "authorized"));
    }
}

