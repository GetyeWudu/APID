package com.boa.apid.core.organization.event;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

/**
 * Observes committed hierarchy events after transaction commit.
 * Cross-module consumers (e.g., Phase 6 Coaching replacement workflows) subscribe independently using AFTER_COMMIT.
 */
@Component
public class HierarchyEventAuditLogger {

    private static final Logger log = LoggerFactory.getLogger(HierarchyEventAuditLogger.class);

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onManagerChanged(EmployeeManagerChangedEvent event) {
        log.info("Committed manager change for employee={} ({}): {} -> {} via {}",
                event.employeeNumber(), event.employeeId(), event.oldManagerId(), event.newManagerId(), event.changeSource());
    }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onEmploymentStatusChanged(EmployeeEmploymentStatusChangedEvent event) {
        log.info("Committed employment status change for employee={} ({}): {} -> {} via {}",
                event.employeeNumber(), event.employeeId(), event.oldStatus(), event.newStatus(), event.changeSource());
    }
}

