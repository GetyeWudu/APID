package com.boa.apid.core.audit.entity;

import jakarta.persistence.*;
import org.hibernate.annotations.Immutable;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.Instant;
import java.util.Map;

/**
 * Append-only security and operational audit trail entry (protected by @Immutable and DB trigger).
 */
@Entity
@Immutable
@Table(name = "audit_logs", schema = "core")
public class AuditLog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "request_id", length = 64, updatable = false)
    private String requestId;

    @Column(name = "actor_user_id", updatable = false)
    private Long actorUserId;

    @Column(name = "actor_username", length = 100, updatable = false)
    private String actorUsername;

    @Column(name = "target_user_id", updatable = false)
    private Long targetUserId;

    @Column(name = "module", nullable = false, length = 40, updatable = false)
    private String module;

    @Column(name = "action", nullable = false, length = 80, updatable = false)
    private String action;

    @Column(name = "result", nullable = false, length = 20, updatable = false)
    private String result = "SUCCESS";

    @Column(name = "reason_code", length = 80, updatable = false)
    private String reasonCode;

    @Column(name = "entity_type", length = 60, updatable = false)
    private String entityType;

    @Column(name = "entity_id", length = 60, updatable = false)
    private String entityId;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "details_json", columnDefinition = "jsonb", updatable = false)
    private Map<String, Object> detailsJson;

    @Column(name = "ip_address", length = 64, updatable = false)
    private String ipAddress;

    @Column(name = "user_agent", length = 255, updatable = false)
    private String userAgent;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @PrePersist
    protected void onCreate() {
        if (this.createdAt == null) {
            this.createdAt = Instant.now();
        }
    }

    public Long getId() { return id; }
    public String getRequestId() { return requestId; }
    public void setRequestId(String requestId) { this.requestId = requestId; }
    public Long getActorUserId() { return actorUserId; }
    public void setActorUserId(Long actorUserId) { this.actorUserId = actorUserId; }
    public String getActorUsername() { return actorUsername; }
    public void setActorUsername(String actorUsername) { this.actorUsername = actorUsername; }
    public Long getTargetUserId() { return targetUserId; }
    public void setTargetUserId(Long targetUserId) { this.targetUserId = targetUserId; }
    public String getModule() { return module; }
    public void setModule(String module) { this.module = module; }
    public String getAction() { return action; }
    public void setAction(String action) { this.action = action; }
    public String getResult() { return result; }
    public void setResult(String result) { this.result = result; }
    public String getReasonCode() { return reasonCode; }
    public void setReasonCode(String reasonCode) { this.reasonCode = reasonCode; }
    public String getEntityType() { return entityType; }
    public void setEntityType(String entityType) { this.entityType = entityType; }
    public String getEntityId() { return entityId; }
    public void setEntityId(String entityId) { this.entityId = entityId; }
    public Map<String, Object> getDetailsJson() { return detailsJson; }
    public void setDetailsJson(Map<String, Object> detailsJson) { this.detailsJson = detailsJson; }
    public String getIpAddress() { return ipAddress; }
    public void setIpAddress(String ipAddress) { this.ipAddress = ipAddress; }
    public String getUserAgent() { return userAgent; }
    public void setUserAgent(String userAgent) { this.userAgent = userAgent; }
    public Instant getCreatedAt() { return createdAt; }
}

