package com.boa.apid.core.organization.event;

import java.time.Instant;

/**
 * Published after transaction commit when an employee's direct reporting manager changes.
 * Future Coaching module consumers should evaluate a persistent outbox if guaranteed retry across crashes is required.
 */
public record EmployeeManagerChangedEvent(
        Long employeeId,
        String employeeNumber,
        Long oldManagerId,
        Long newManagerId,
        String changeSource,
        Instant occurredAt
) {}

