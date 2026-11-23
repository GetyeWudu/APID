package com.boa.apid.core.auth.controller;

import com.boa.apid.common.response.ApiResponse;
import com.boa.apid.core.auth.config.LdapProperties;
import com.boa.apid.core.auth.service.ActiveDirectorySyncScheduler;
import com.boa.apid.core.auth.service.ActiveDirectorySyncService;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/api/v1/core/admin/ldap")
public class LdapSyncAdminController {

    private final LdapProperties ldapProperties;
    private final ActiveDirectorySyncScheduler syncScheduler;

    public LdapSyncAdminController(LdapProperties ldapProperties, ActiveDirectorySyncScheduler syncScheduler) {
        this.ldapProperties = ldapProperties;
        this.syncScheduler = syncScheduler;
    }

    @PostMapping("/sync")
    @PreAuthorize("hasAuthority('USER_MANAGE')")
    public ApiResponse<ActiveDirectorySyncService.AdSyncResult> triggerManualSync() {
        ActiveDirectorySyncService.AdSyncResult result = syncScheduler.triggerSync("Admin manual REST trigger");
        return ApiResponse.ok(result.message(), result);
    }

    @GetMapping("/status")
    @PreAuthorize("hasAuthority('USER_MANAGE')")
    public ApiResponse<Map<String, Object>> getLdapStatus() {
        return ApiResponse.ok(Map.of(
                "enabled", ldapProperties.isEnabled(),
                "url", ldapProperties.getUrl(),
                "baseDn", ldapProperties.getBaseDn(),
                "domain", ldapProperties.getDomain(),
                "userSearchBase", ldapProperties.getUserSearchBase(),
                "syncEnabled", ldapProperties.isSyncEnabled(),
                "syncCron", ldapProperties.getSyncCron()
        ));
    }
}
