package com.boa.apid.core.audit.controller;

import com.boa.apid.common.response.ApiResponse;
import com.boa.apid.core.audit.dto.AuditEventDto;
import com.boa.apid.core.audit.service.AuditService;
import org.springframework.data.domain.Page;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/core/admin/audit-logs")
public class AuditController {

    private final AuditService auditService;

    public AuditController(AuditService auditService) {
        this.auditService = auditService;
    }

    @GetMapping
    @PreAuthorize("hasAuthority('AUDIT_LOG_VIEW')")
    public ApiResponse<Page<AuditEventDto>> search(
            @RequestParam(required = false) String module,
            @RequestParam(required = false) String action,
            @RequestParam(required = false) String actorUsername,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size
    ) {
        return ApiResponse.ok(auditService.search(module, action, actorUsername, page, size));
    }
}

