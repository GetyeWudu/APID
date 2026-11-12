package com.boa.apid.core.organization.event;

import com.boa.apid.core.organization.entity.EmploymentStatus;

import java.time.Instant;

/**
 * Published after transaction commit when an employee's employment status transitions (e.g., ACTIVE -> TERMINATED).
 */
public record EmployeeEmploymentStatusChangedEvent(
        Long employeeId,
        String employeeNumber,
        EmploymentStatus oldStatus,
        EmploymentStatus newStatus,
        String changeSource,
        Instant occurredAt
) {}

