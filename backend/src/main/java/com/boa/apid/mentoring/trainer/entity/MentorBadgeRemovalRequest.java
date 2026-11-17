package com.boa.apid.mentoring.trainer.entity;

import com.boa.apid.core.authorization.entity.User;
import jakarta.persistence.*;

import java.time.Instant;

@Entity
@Table(name = "mentor_badge_removal_requests", schema = "mentoring")
public class MentorBadgeRemovalRequest {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "trainer_auth_id", nullable = false)
    private TrainerAuthorization authorization;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "requested_by_user_id", nullable = false)
    private User requestedBy;

    @Column(name = "request_reason", length = 1000)
    private String reason;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private MentorBadgeRemovalRequestStatus status = MentorBadgeRemovalRequestStatus.PENDING;

    @Enumerated(EnumType.STRING)
    @Column(name = "approval_disposition", length = 30)
    private MentorBadgeRemovalDisposition disposition;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "reviewed_by_user_id")
    private User reviewedBy;

    @Column(name = "reviewed_at")
    private Instant reviewedAt;

    @Column(name = "decision_reason", length = 1000)
    private String decisionReason;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @PrePersist
    void onCreate() {
        if (createdAt == null) {
            createdAt = Instant.now();
        }
    }

    public Long getId() { return id; }
    public TrainerAuthorization getAuthorization() { return authorization; }
    public void setAuthorization(TrainerAuthorization authorization) { this.authorization = authorization; }
    public User getRequestedBy() { return requestedBy; }
    public void setRequestedBy(User requestedBy) { this.requestedBy = requestedBy; }
    public String getReason() { return reason; }
    public void setReason(String reason) { this.reason = reason; }
    public MentorBadgeRemovalRequestStatus getStatus() { return status; }
    public void setStatus(MentorBadgeRemovalRequestStatus status) { this.status = status; }
    public MentorBadgeRemovalDisposition getDisposition() { return disposition; }
    public void setDisposition(MentorBadgeRemovalDisposition disposition) { this.disposition = disposition; }
    public User getReviewedBy() { return reviewedBy; }
    public void setReviewedBy(User reviewedBy) { this.reviewedBy = reviewedBy; }
    public Instant getReviewedAt() { return reviewedAt; }
    public void setReviewedAt(Instant reviewedAt) { this.reviewedAt = reviewedAt; }
    public String getDecisionReason() { return decisionReason; }
    public void setDecisionReason(String decisionReason) { this.decisionReason = decisionReason; }
    public Instant getCreatedAt() { return createdAt; }
}
