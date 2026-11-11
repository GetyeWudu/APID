package com.boa.apid.core.audit.dto;

import java.time.Instant;
import java.util.Map;

public record AuditEventDto(
        Long id,
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
        Map<String, Object> detailsJson,
        String ipAddress,
        String userAgent,
        Instant createdAt
) {}

