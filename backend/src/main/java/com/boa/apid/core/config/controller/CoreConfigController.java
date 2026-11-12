package com.boa.apid.core.config.controller;

import com.boa.apid.common.response.ApiResponse;
import com.boa.apid.core.auth.security.ApidUserPrincipal;
import com.boa.apid.core.config.dto.*;
import com.boa.apid.core.config.service.CoreConfigService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/core")
public class CoreConfigController {

    private final CoreConfigService coreConfigService;

    public CoreConfigController(CoreConfigService coreConfigService) {
        this.coreConfigService = coreConfigService;
    }

    @GetMapping("/config/active")
    @PreAuthorize("isAuthenticated() and !principal.mustChangePassword")
    public ApiResponse<ActiveConfigResponseDto> getActiveConfig() {
        return ApiResponse.ok(coreConfigService.getActiveConfigSnapshot());
    }

    @GetMapping("/admin/config")
    @PreAuthorize("hasAuthority('SYSTEM_CONFIG_MANAGE')")
    public ApiResponse<AdminConfigViewDto> getAdminConfig() {
        return ApiResponse.ok(coreConfigService.getAdminConfigView());
    }

    @PutMapping("/admin/config")
    @PreAuthorize("hasAuthority('SYSTEM_CONFIG_MANAGE')")
    public ApiResponse<List<SystemConfigItemDto>> updateConfigs(
            @Valid @RequestBody UpdateSystemConfigsRequest request,
            @AuthenticationPrincipal ApidUserPrincipal actor,
            HttpServletRequest httpRequest
    ) {
        List<SystemConfigItemDto> updated = coreConfigService.updateConfigs(
                request,
                actor,
                resolveClientIp(httpRequest),
                httpRequest.getHeader("User-Agent")
        );
        return ApiResponse.ok("System configuration updated", updated);
    }

    @GetMapping("/fiscal-quarters")
    @PreAuthorize("isAuthenticated()")
    public ApiResponse<List<FiscalQuarterDto>> listQuarters() {
        return ApiResponse.ok(coreConfigService.listAllQuarters());
    }

    @GetMapping("/admin/fiscal-quarters")
    @PreAuthorize("hasAuthority('SYSTEM_CONFIG_MANAGE')")
    public ApiResponse<List<FiscalQuarterDto>> listAdminQuarters() {
        return ApiResponse.ok(coreConfigService.listAllQuarters());
    }

    @PostMapping("/admin/fiscal-quarters")
    @PreAuthorize("hasAuthority('SYSTEM_CONFIG_MANAGE')")
    public ApiResponse<FiscalQuarterDto> createQuarter(
            @Valid @RequestBody CreateFiscalQuarterRequest request,
            @AuthenticationPrincipal ApidUserPrincipal actor,
            HttpServletRequest httpRequest
    ) {
        FiscalQuarterDto created = coreConfigService.createQuarter(
                request,
                actor,
                resolveClientIp(httpRequest),
                httpRequest.getHeader("User-Agent")
        );
        return ApiResponse.ok("Fiscal quarter created", created);
    }

    @PutMapping("/admin/fiscal-quarters/{id}")
    @PreAuthorize("hasAuthority('SYSTEM_CONFIG_MANAGE')")
    public ApiResponse<FiscalQuarterDto> updateQuarter(
            @PathVariable Long id,
            @Valid @RequestBody UpdateFiscalQuarterRequest request,
            @AuthenticationPrincipal ApidUserPrincipal actor,
            HttpServletRequest httpRequest
    ) {
        FiscalQuarterDto updated = coreConfigService.updateQuarter(
                id,
                request,
                actor,
                resolveClientIp(httpRequest),
                httpRequest.getHeader("User-Agent")
        );
        return ApiResponse.ok("Fiscal quarter updated", updated);
    }

    @PostMapping("/admin/fiscal-quarters/{id}/activate")
    @PreAuthorize("hasAuthority('SYSTEM_CONFIG_MANAGE')")
    public ApiResponse<FiscalQuarterDto> activateQuarter(
            @PathVariable Long id,
            @AuthenticationPrincipal ApidUserPrincipal actor,
            HttpServletRequest httpRequest
    ) {
        FiscalQuarterDto activated = coreConfigService.activateQuarter(
                id,
                actor,
                resolveClientIp(httpRequest),
                httpRequest.getHeader("User-Agent")
        );
        return ApiResponse.ok("Active fiscal quarter updated", activated);
    }

    private String resolveClientIp(HttpServletRequest req) {
        String forwarded = req.getHeader("X-Forwarded-For");
        if (forwarded != null && !forwarded.isBlank()) {
            return forwarded.split(",")[0].trim();
        }
        return req.getRemoteAddr();
    }
}
