package com.boa.apid.coaching.governance.entity;

import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(name = "session_targets", schema = "coaching")
public class CoachingSessionTarget {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "assignment_id")
    private Long assignmentId;

    @Column(name = "skill_request_id")
    private Long skillRequestId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "policy_version_id")
    private CoachingPolicyVersion policyVersion;

    @Column(name = "policy_baseline", nullable = false)
    private int policyBaseline;

    @Column(name = "approved_target", nullable = false)
    private int approvedTarget;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 30)
    private TargetStatus status = TargetStatus.APPROVED;

    @Column(name = "justification_notes", columnDefinition = "TEXT")
    private String justificationNotes;

    @Column(name = "approved_by_user_id")
    private Long approvedByUserId;

    @Column(name = "approved_at")
    private Instant approvedAt;

    @Column(name = "early_completion_reason", columnDefinition = "TEXT")
    private String earlyCompletionReason;

    @Column(name = "early_completed_at")
    private Instant earlyCompletedAt;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @PrePersist
    void onCreate() {
        this.createdAt = Instant.now();
        this.updatedAt = Instant.now();
    }

    @PreUpdate
    void onUpdate() {
        this.updatedAt = Instant.now();
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Long getAssignmentId() { return assignmentId; }
    public void setAssignmentId(Long assignmentId) { this.assignmentId = assignmentId; }

    public Long getSkillRequestId() { return skillRequestId; }
    public void setSkillRequestId(Long skillRequestId) { this.skillRequestId = skillRequestId; }

    public CoachingPolicyVersion getPolicyVersion() { return policyVersion; }
    public void setPolicyVersion(CoachingPolicyVersion policyVersion) { this.policyVersion = policyVersion; }

    public int getPolicyBaseline() { return policyBaseline; }
    public void setPolicyBaseline(int policyBaseline) { this.policyBaseline = policyBaseline; }

    public int getApprovedTarget() { return approvedTarget; }
    public void setApprovedTarget(int approvedTarget) { this.approvedTarget = approvedTarget; }

    public TargetStatus getStatus() { return status; }
    public void setStatus(TargetStatus status) { this.status = status; }

    public String getJustificationNotes() { return justificationNotes; }
    public void setJustificationNotes(String justificationNotes) { this.justificationNotes = justificationNotes; }

    public Long getApprovedByUserId() { return approvedByUserId; }
    public void setApprovedByUserId(Long approvedByUserId) { this.approvedByUserId = approvedByUserId; }

    public Instant getApprovedAt() { return approvedAt; }
    public void setApprovedAt(Instant approvedAt) { this.approvedAt = approvedAt; }

    public String getEarlyCompletionReason() { return earlyCompletionReason; }
    public void setEarlyCompletionReason(String earlyCompletionReason) { this.earlyCompletionReason = earlyCompletionReason; }

    public Instant getEarlyCompletedAt() { return earlyCompletedAt; }
    public void setEarlyCompletedAt(Instant earlyCompletedAt) { this.earlyCompletedAt = earlyCompletedAt; }

    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
}

