package com.boa.apid.core.dashboard.dto;

import java.util.List;

/**
 * Permission-scoped System Admin dashboard aggregates computed server-side from Core repositories.
 * Sections whose permissions the caller lacks are returned as null.
 */
public record AdminDashboardSummaryDto(
        UserSummary users,
        EmployeeSummary employees,
        DepartmentSummary departments,
        SkillSummary skills,
        AuditSummary audit24h,
        Integer totalCatalogPermissions,
        List<RoleCoverageItem> roles,
        boolean redisMonitoringAvailable
) {
    public record UserSummary(
            long total,
            long active,
            long temporarilyLocked,
            long disabled,
            long adminLocked,
            long mustChangePassword
    ) {}

    public record EmployeeSummary(
            long total,
            long active,
            long linkedAccounts,
            long unlinkedAccounts,
            long activeReportingLinks
    ) {}

    public record DepartmentSummary(
            long total,
            long active
    ) {}

    public record SkillSummary(
            long total,
            long active
    ) {}

    public record AuditSummary(
            long totalEvents,
            long nonSuccessEvents
    ) {}

    public record RoleCoverageItem(
            Long id,
            String name,
            boolean systemProtected,
            boolean active,
            int permissionCount,
            long activeUserCount
    ) {}
}

