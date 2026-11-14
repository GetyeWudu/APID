package com.boa.apid.coaching.governance.entity;

import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(name = "target_adjustments", schema = "coaching")
public class CoachingTargetAdjustment {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "session_target_id", nullable = false)
    private Long sessionTargetId;

    @Enumerated(EnumType.STRING)
    @Column(name = "adjustment_type", nullable = false, length = 30)
    private AdjustmentType adjustmentType;

    @Column(name = "requested_by_employee_id", nullable = false)
    private Long requestedByEmployeeId;

    @Column(name = "previous_target", nullable = false)
    private int previousTarget;

    @Column(name = "proposed_target", nullable = false)
    private int proposedTarget;

    @Column(name = "reason", nullable = false, columnDefinition = "TEXT")
    private String reason;

    @Column(name = "pms_reviewer_id")
    private Long pmsReviewerId;

    @Enumerated(EnumType.STRING)
    @Column(name = "pms_decision", nullable = false, length = 30)
    private AdjustmentDecision pmsDecision = AdjustmentDecision.PENDING;

    @Column(name = "decision_notes", columnDefinition = "TEXT")
    private String decisionNotes;

    @Column(name = "decided_at")
    private Instant decidedAt;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @PrePersist
    void onCreate() {
        this.createdAt = Instant.now();
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Long getSessionTargetId() { return sessionTargetId; }
    public void setSessionTargetId(Long sessionTargetId) { this.sessionTargetId = sessionTargetId; }

    public AdjustmentType getAdjustmentType() { return adjustmentType; }
    public void setAdjustmentType(AdjustmentType adjustmentType) { this.adjustmentType = adjustmentType; }

    public Long getRequestedByEmployeeId() { return requestedByEmployeeId; }
    public void setRequestedByEmployeeId(Long requestedByEmployeeId) { this.requestedByEmployeeId = requestedByEmployeeId; }

    public int getPreviousTarget() { return previousTarget; }
    public void setPreviousTarget(int previousTarget) { this.previousTarget = previousTarget; }

    public int getProposedTarget() { return proposedTarget; }
    public void setProposedTarget(int proposedTarget) { this.proposedTarget = proposedTarget; }

    public String getReason() { return reason; }
    public void setReason(String reason) { this.reason = reason; }

    public Long getPmsReviewerId() { return pmsReviewerId; }
    public void setPmsReviewerId(Long pmsReviewerId) { this.pmsReviewerId = pmsReviewerId; }

    public AdjustmentDecision getPmsDecision() { return pmsDecision; }
    public void setPmsDecision(AdjustmentDecision pmsDecision) { this.pmsDecision = pmsDecision; }

    public String getDecisionNotes() { return decisionNotes; }
    public void setDecisionNotes(String decisionNotes) { this.decisionNotes = decisionNotes; }

    public Instant getDecidedAt() { return decidedAt; }
    public void setDecidedAt(Instant decidedAt) { this.decidedAt = decidedAt; }

    public Instant getCreatedAt() { return createdAt; }
}

