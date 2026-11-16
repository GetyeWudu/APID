package com.boa.apid.mentoring.trainer.entity;

import com.boa.apid.core.skills.entity.Skill;
import jakarta.persistence.*;

import java.time.Instant;

@Entity
@Table(
        name = "trainer_authorization_skill_status",
        schema = "mentoring",
        uniqueConstraints = @UniqueConstraint(
                name = "uq_trainer_authorization_skill_status",
                columnNames = {"trainer_auth_id", "skill_id"}
        )
)
public class TrainerAuthorizationSkillStatus {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "trainer_auth_id", nullable = false)
    private TrainerAuthorization authorization;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "skill_id", nullable = false)
    private Skill skill;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private TrainerAuthorizationStatus status = TrainerAuthorizationStatus.ACTIVE;

    @Column(name = "status_reason", length = 1000)
    private String statusReason;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @PrePersist
    @PreUpdate
    void updateTimestamp() {
        updatedAt = Instant.now();
    }

    public Long getId() { return id; }
    public TrainerAuthorization getAuthorization() { return authorization; }
    public void setAuthorization(TrainerAuthorization authorization) { this.authorization = authorization; }
    public Skill getSkill() { return skill; }
    public void setSkill(Skill skill) { this.skill = skill; }
    public TrainerAuthorizationStatus getStatus() { return status; }
    public void setStatus(TrainerAuthorizationStatus status) { this.status = status; }
    public String getStatusReason() { return statusReason; }
    public void setStatusReason(String statusReason) { this.statusReason = statusReason; }
    public Instant getUpdatedAt() { return updatedAt; }
}
