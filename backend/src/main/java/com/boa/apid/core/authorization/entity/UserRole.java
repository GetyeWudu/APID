package com.boa.apid.core.authorization.entity;

import jakarta.persistence.*;
import java.time.Instant;

/**
 * Explicit User-Role join entity supporting assignment metadata, revocation, and audit tracking.
 */
@Entity
@Table(name = "user_roles", schema = "core")
public class UserRole {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "role_id", nullable = false)
    private Role role;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "assigned_by")
    private User assignedBy;

    @Column(name = "assigned_at", nullable = false, updatable = false)
    private Instant assignedAt;

    @Column(name = "active", nullable = false)
    private boolean active = true;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "revoked_by")
    private User revokedBy;

    @Column(name = "revoked_at")
    private Instant revokedAt;

    @PrePersist
    protected void onCreate() {
        if (this.assignedAt == null) {
            this.assignedAt = Instant.now();
        }
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public User getUser() { return user; }
    public void setUser(User user) { this.user = user; }

    public Role getRole() { return role; }
    public void setRole(Role role) { this.role = role; }

    public User getAssignedBy() { return assignedBy; }
    public void setAssignedBy(User assignedBy) { this.assignedBy = assignedBy; }

    public Instant getAssignedAt() { return assignedAt; }

    public boolean isActive() { return active; }
    public void setActive(boolean active) { this.active = active; }

    public User getRevokedBy() { return revokedBy; }
    public void setRevokedBy(User revokedBy) { this.revokedBy = revokedBy; }

    public Instant getRevokedAt() { return revokedAt; }
    public void setRevokedAt(Instant revokedAt) { this.revokedAt = revokedAt; }
}

