package com.boa.apid.core.dashboard.controller;

import com.boa.apid.common.response.ApiResponse;
import com.boa.apid.core.auth.security.ApidUserPrincipal;
import com.boa.apid.core.dashboard.dto.AdminDashboardSummaryDto;
import com.boa.apid.core.dashboard.service.AdminDashboardSummaryService;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/core/admin/dashboard")
public class AdminDashboardSummaryController {

    private final AdminDashboardSummaryService summaryService;

    public AdminDashboardSummaryController(AdminDashboardSummaryService summaryService) {
        this.summaryService = summaryService;
    }

    @GetMapping("/summary")
    @PreAuthorize("hasAnyAuthority('USER_MANAGE','HIERARCHY_MANAGE','ROLE_PERMISSION_MANAGE','AUDIT_LOG_VIEW','SKILL_MANAGE','SYSTEM_CONFIG_MANAGE')")
    public ApiResponse<AdminDashboardSummaryDto> getSummary(@AuthenticationPrincipal ApidUserPrincipal actor) {
        return ApiResponse.ok(summaryService.getSummary(actor));
    }
}

