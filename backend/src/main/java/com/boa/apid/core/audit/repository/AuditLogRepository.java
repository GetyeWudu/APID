package com.boa.apid.core.audit.repository;

import com.boa.apid.core.audit.entity.AuditLog;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface AuditLogRepository extends JpaRepository<AuditLog, Long>, JpaSpecificationExecutor<AuditLog> {

    long countByCreatedAtAfter(Instant since);

    long countByCreatedAtAfterAndResultIgnoreCase(Instant since, String result);

    Optional<AuditLog> findFirstByEntityTypeAndEntityIdAndTargetUserIdAndResultAndActionInOrderByCreatedAtDescIdDesc(
            String entityType,
            String entityId,
            Long targetUserId,
            String result,
            Collection<String> actions
    );

    List<AuditLog> findByEntityTypeAndEntityIdAndResultAndActionInOrderByCreatedAtDescIdDesc(
            String entityType,
            String entityId,
            String result,
            Collection<String> actions
    );
}

