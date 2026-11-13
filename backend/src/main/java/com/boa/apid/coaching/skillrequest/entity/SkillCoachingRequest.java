package com.boa.apid.coaching.skillrequest.entity;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "skill_coaching_requests", schema = "coaching")
public class SkillCoachingRequest {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "requester_employee_id", nullable = false)
    private Long requesterEmployeeId;

    @Column(name = "proposed_coach_employee_id")
    private Long proposedCoachEmployeeId;

    @Column(name = "coaching_fiscal_quarter_id", nullable = false)
    private Long coachingFiscalQuarterId;

    @Column(name = "skill_title", nullable = false, length = 200)
    private String skillTitle;

    @Column(name = "business_justification", nullable = false, columnDefinition = "TEXT")
    private String businessJustification;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 30)
    private SkillCoachingRequestStatus status = SkillCoachingRequestStatus.PENDING_APPROVAL;

    @Column(name = "reviewed_by_user_id")
    private Long reviewedByUserId;

    @Column(name = "review_notes", columnDefinition = "TEXT")
    private String reviewNotes;

    @Column(name = "reviewed_at")
    private Instant reviewedAt;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @OneToMany(mappedBy = "request", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<SkillCoachingRequestTarget> targets = new ArrayList<>();

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
    public Long getRequesterEmployeeId() { return requesterEmployeeId; }
    public void setRequesterEmployeeId(Long requesterEmployeeId) { this.requesterEmployeeId = requesterEmployeeId; }
    public Long getProposedCoachEmployeeId() { return proposedCoachEmployeeId; }
    public void setProposedCoachEmployeeId(Long proposedCoachEmployeeId) { this.proposedCoachEmployeeId = proposedCoachEmployeeId; }
    public Long getCoachingFiscalQuarterId() { return coachingFiscalQuarterId; }
    public void setCoachingFiscalQuarterId(Long coachingFiscalQuarterId) { this.coachingFiscalQuarterId = coachingFiscalQuarterId; }
    public String getSkillTitle() { return skillTitle; }
    public void setSkillTitle(String skillTitle) { this.skillTitle = skillTitle; }
    public String getBusinessJustification() { return businessJustification; }
    public void setBusinessJustification(String businessJustification) { this.businessJustification = businessJustification; }
    public SkillCoachingRequestStatus getStatus() { return status; }
    public void setStatus(SkillCoachingRequestStatus status) { this.status = status; }
    public Long getReviewedByUserId() { return reviewedByUserId; }
    public void setReviewedByUserId(Long reviewedByUserId) { this.reviewedByUserId = reviewedByUserId; }
    public String getReviewNotes() { return reviewNotes; }
    public void setReviewNotes(String reviewNotes) { this.reviewNotes = reviewNotes; }
    public Instant getReviewedAt() { return reviewedAt; }
    public void setReviewedAt(Instant reviewedAt) { this.reviewedAt = reviewedAt; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
    public List<SkillCoachingRequestTarget> getTargets() { return targets; }
    public void setTargets(List<SkillCoachingRequestTarget> targets) { this.targets = targets; }
}

