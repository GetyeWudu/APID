package com.boa.apid.mentoring.trainer.entity;

import com.boa.apid.core.authorization.entity.User;
import com.boa.apid.core.skills.entity.Skill;
import jakarta.persistence.*;

import java.time.Instant;

@Entity
@Table(name = "trainer_status_history", schema = "mentoring")
public class TrainerStatusHistory {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "trainer_auth_id", nullable = false)
    private TrainerAuthorization authorization;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "skill_id")
    private Skill skill;

    @Enumerated(EnumType.STRING)
    @Column(name = "previous_status", length = 20)
    private TrainerAuthorizationStatus previousStatus;

    @Enumerated(EnumType.STRING)
    @Column(name = "new_status", nullable = false, length = 20)
    private TrainerAuthorizationStatus newStatus;

    @Column(nullable = false, length = 1000)
    private String reason;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "changed_by_user_id", nullable = false)
    private User changedBy;

    @Column(name = "changed_at", nullable = false, updatable = false)
    private Instant changedAt;

    @PrePersist
    void onCreate() {
        if (changedAt == null) {
            changedAt = Instant.now();
        }
    }

    public Long getId() { return id; }
    public TrainerAuthorization getAuthorization() { return authorization; }
    public void setAuthorization(TrainerAuthorization authorization) { this.authorization = authorization; }
    public Skill getSkill() { return skill; }
    public void setSkill(Skill skill) { this.skill = skill; }
    public TrainerAuthorizationStatus getPreviousStatus() { return previousStatus; }
    public void setPreviousStatus(TrainerAuthorizationStatus previousStatus) { this.previousStatus = previousStatus; }
    public TrainerAuthorizationStatus getNewStatus() { return newStatus; }
    public void setNewStatus(TrainerAuthorizationStatus newStatus) { this.newStatus = newStatus; }
    public String getReason() { return reason; }
    public void setReason(String reason) { this.reason = reason; }
    public User getChangedBy() { return changedBy; }
    public void setChangedBy(User changedBy) { this.changedBy = changedBy; }
    public Instant getChangedAt() { return changedAt; }
}
