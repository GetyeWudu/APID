package com.boa.apid.core.audit.repository;

import com.boa.apid.core.audit.entity.AuditLog;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

import java.time.Instant;

public interface AuditLogRepository extends JpaRepository<AuditLog, Long>, JpaSpecificationExecutor<AuditLog> {

    long countByCreatedAtAfter(Instant since);

    long countByCreatedAtAfterAndResultIgnoreCase(Instant since, String result);
}

