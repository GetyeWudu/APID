package com.boa.apid.core.audit.service;

import com.boa.apid.core.audit.dto.AuditEventDto;
import com.boa.apid.core.audit.entity.AuditLog;
import com.boa.apid.core.audit.repository.AuditLogRepository;
import jakarta.persistence.criteria.Predicate;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
public class AuditService {

    private static final int MAX_PAGE_SIZE = 100;

    private final AuditLogRepository auditLogRepository;

    public AuditService(AuditLogRepository auditLogRepository) {
        this.auditLogRepository = auditLogRepository;
    }

    /**
     * Records an audit event inside the caller's transaction so mutations and audit logs commit/rollback atomically.
     */
    @Transactional(propagation = Propagation.REQUIRED)
    public void record(AuditCommand cmd) {
        saveLog(cmd);
    }

    /**
     * Records an audit event in an independent transaction (used for failed logins / lockouts that return errors).
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void recordIndependent(AuditCommand cmd) {
        saveLog(cmd);
    }

    @Transactional(readOnly = true)
    public Page<AuditEventDto> search(String module, String action, String actorUsername, int page, int size) {
        int safePage = Math.max(page, 0);
        int safeSize = Math.min(Math.max(size, 1), MAX_PAGE_SIZE);
        Pageable pageable = PageRequest.of(safePage, safeSize,
                Sort.by(Sort.Order.desc("createdAt"), Sort.Order.desc("id")));

        Specification<AuditLog> spec = (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();
            if (module != null && !module.isBlank()) {
                predicates.add(cb.equal(cb.upper(root.get("module")), module.trim().toUpperCase()));
            }
            if (action != null && !action.isBlank()) {
                predicates.add(cb.equal(cb.upper(root.get("action")), action.trim().toUpperCase()));
            }
            if (actorUsername != null && !actorUsername.isBlank()) {
                predicates.add(cb.like(cb.lower(root.get("actorUsername")),
                        "%" + actorUsername.trim().toLowerCase() + "%"));
            }
            return cb.and(predicates.toArray(Predicate[]::new));
        };

        return auditLogRepository.findAll(spec, pageable).map(this::toDto);
    }

    private void saveLog(AuditCommand cmd) {
        AuditLog entry = new AuditLog();
        entry.setRequestId(cmd.requestId() != null ? cmd.requestId() : UUID.randomUUID().toString());
        entry.setActorUserId(cmd.actorUserId());
        entry.setActorUsername(cmd.actorUsername());
        entry.setTargetUserId(cmd.targetUserId());
        entry.setModule(cmd.module());
        entry.setAction(cmd.action());
        entry.setResult(cmd.result() != null ? cmd.result() : "SUCCESS");
        entry.setReasonCode(cmd.reasonCode());
        entry.setEntityType(cmd.entityType());
        entry.setEntityId(cmd.entityId());
        entry.setDetailsJson(normalizeDetails(cmd.details()));
        entry.setIpAddress(cmd.ipAddress());
        entry.setUserAgent(truncate(cmd.userAgent(), 255));
        auditLogRepository.save(entry);
    }

    private Map<String, Object> normalizeDetails(Map<String, Object> raw) {
        if (raw == null || raw.isEmpty()) {
            return null;
        }
        Map<String, Object> normalized = new LinkedHashMap<>();
        raw.forEach((k, v) -> normalized.put(k, normalizeValue(v)));
        return normalized;
    }

    private Object normalizeValue(Object value) {
        if (value instanceof Collection<?> col) {
            return col.stream().map(this::normalizeValue).toList();
        }
        if (value instanceof Map<?, ?> map) {
            Map<String, Object> nested = new LinkedHashMap<>();
            map.forEach((k, v) -> nested.put(String.valueOf(k), normalizeValue(v)));
            return nested;
        }
        return value;
    }

    private AuditEventDto toDto(AuditLog log) {
        return new AuditEventDto(
                log.getId(),
                log.getRequestId(),
                log.getActorUserId(),
                log.getActorUsername(),
                log.getTargetUserId(),
                log.getModule(),
                log.getAction(),
                log.getResult(),
                log.getReasonCode(),
                log.getEntityType(),
                log.getEntityId(),
                log.getDetailsJson(),
                log.getIpAddress(),
                log.getUserAgent(),
                log.getCreatedAt()
        );
    }

    private String truncate(String s, int max) {
        if (s == null) return null;
        return s.length() <= max ? s : s.substring(0, max);
    }

    public record AuditCommand(
            String requestId,
            Long actorUserId,
            String actorUsername,
            Long targetUserId,
            String module,
            String action,
            String result,
            String reasonCode,
            String entityType,
            String entityId,
            Map<String, Object> details,
            String ipAddress,
            String userAgent
    ) {}
}

