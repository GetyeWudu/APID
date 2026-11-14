package com.boa.apid.coaching.governance.entity;

import com.boa.apid.coaching.assignment.entity.AssignmentPathway;
import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.Instant;

@Entity
@Table(name = "policy_versions", schema = "coaching")
public class CoachingPolicyVersion {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "version_tag", nullable = false, length = 50)
    private String versionTag;

    @Column(name = "policy_name", nullable = false, length = 120)
    private String policyName;

    @Enumerated(EnumType.STRING)
    @Column(name = "pathway", nullable = false, length = 30)
    private AssignmentPathway pathway;

    @Column(name = "min_appraisal_rating", precision = 4, scale = 2)
    private BigDecimal minAppraisalRating;

    @Column(name = "max_appraisal_rating", precision = 4, scale = 2)
    private BigDecimal maxAppraisalRating;

    @Column(name = "baseline_sessions", nullable = false)
    private int baselineSessions;

    @Column(name = "min_allowed_sessions", nullable = false)
    private int minAllowedSessions;

    @Column(name = "max_allowed_sessions", nullable = false)
    private int maxAllowedSessions;

    @Enumerated(EnumType.STRING)
    @Column(name = "default_cadence", nullable = false, length = 30)
    private CadenceType defaultCadence = CadenceType.WEEKLY;

    @Column(name = "coach_adjustment_allowed", nullable = false)
    private boolean coachAdjustmentAllowed = true;

    @Column(name = "requires_pms_approval_outside_range", nullable = false)
    private boolean requiresPmsApprovalOutsideRange = true;

    @Column(name = "allow_extensions", nullable = false)
    private boolean allowExtensions = true;

    @Column(name = "allow_early_completion", nullable = false)
    private boolean allowEarlyCompletion = true;

    @Column(name = "is_active", nullable = false)
    private boolean isActive = true;

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

    public String getVersionTag() { return versionTag; }
    public void setVersionTag(String versionTag) { this.versionTag = versionTag; }

    public String getPolicyName() { return policyName; }
    public void setPolicyName(String policyName) { this.policyName = policyName; }

    public AssignmentPathway getPathway() { return pathway; }
    public void setPathway(AssignmentPathway pathway) { this.pathway = pathway; }

    public BigDecimal getMinAppraisalRating() { return minAppraisalRating; }
    public void setMinAppraisalRating(BigDecimal minAppraisalRating) { this.minAppraisalRating = minAppraisalRating; }

    public BigDecimal getMaxAppraisalRating() { return maxAppraisalRating; }
    public void setMaxAppraisalRating(BigDecimal maxAppraisalRating) { this.maxAppraisalRating = maxAppraisalRating; }

    public int getBaselineSessions() { return baselineSessions; }
    public void setBaselineSessions(int baselineSessions) { this.baselineSessions = baselineSessions; }

    public int getMinAllowedSessions() { return minAllowedSessions; }
    public void setMinAllowedSessions(int minAllowedSessions) { this.minAllowedSessions = minAllowedSessions; }

    public int getMaxAllowedSessions() { return maxAllowedSessions; }
    public void setMaxAllowedSessions(int maxAllowedSessions) { this.maxAllowedSessions = maxAllowedSessions; }

    public CadenceType getDefaultCadence() { return defaultCadence; }
    public void setDefaultCadence(CadenceType defaultCadence) { this.defaultCadence = defaultCadence; }

    public boolean isCoachAdjustmentAllowed() { return coachAdjustmentAllowed; }
    public void setCoachAdjustmentAllowed(boolean coachAdjustmentAllowed) { this.coachAdjustmentAllowed = coachAdjustmentAllowed; }

    public boolean isRequiresPmsApprovalOutsideRange() { return requiresPmsApprovalOutsideRange; }
    public void setRequiresPmsApprovalOutsideRange(boolean requiresPmsApprovalOutsideRange) { this.requiresPmsApprovalOutsideRange = requiresPmsApprovalOutsideRange; }

    public boolean isAllowExtensions() { return allowExtensions; }
    public void setAllowExtensions(boolean allowExtensions) { this.allowExtensions = allowExtensions; }

    public boolean isAllowEarlyCompletion() { return allowEarlyCompletion; }
    public void setAllowEarlyCompletion(boolean allowEarlyCompletion) { this.allowEarlyCompletion = allowEarlyCompletion; }

    public boolean isActive() { return isActive; }
    public void setActive(boolean active) { isActive = active; }

    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
}

