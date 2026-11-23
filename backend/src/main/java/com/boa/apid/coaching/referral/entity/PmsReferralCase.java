package com.boa.apid.coaching.referral.entity;

import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(name = "pms_referral_cases", schema = "coaching")
public class PmsReferralCase {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "coachee_employee_id", nullable = false)
    private Long coacheeEmployeeId;

    @Column(name = "current_coach_employee_id")
    private Long currentCoachEmployeeId;

    @Column(name = "assignment_id")
    private Long assignmentId;

    @Column(name = "consecutive_low_quarters_count", nullable = false)
    private int consecutiveLowQuartersCount = 2;

    @Column(name = "latest_scores_json", nullable = false, columnDefinition = "TEXT")
    private String latestScoresJson = "[]";

    @Column(name = "coaching_sessions_attended", nullable = false)
    private int coachingSessionsAttended = 0;

    @Column(name = "status", nullable = false, length = 40)
    private String status = "PENDING_ADMIN_ACTION"; // PENDING_ADMIN_ACTION, REASSIGNED, HR_ACTION_TAKEN, DISMISSED

    @Column(name = "new_coach_employee_id")
    private Long newCoachEmployeeId;

    @Column(name = "pms_admin_user_id")
    private Long pmsAdminUserId;

    @Column(name = "resolution_type", length = 40)
    private String resolutionType; // REASSIGN_COACH, HR_PIP, DISMISSED

    @Column(name = "resolution_notes", columnDefinition = "TEXT")
    private String resolutionNotes;

    @Column(name = "escalated_at", nullable = false)
    private Instant escalatedAt = Instant.now();

    @Column(name = "resolved_at")
    private Instant resolvedAt;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt = Instant.now();

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt = Instant.now();

    @PrePersist
    void onCreate() {
        if (createdAt == null) createdAt = Instant.now();
        if (updatedAt == null) updatedAt = Instant.now();
        if (escalatedAt == null) escalatedAt = Instant.now();
    }

    @PreUpdate
    void onUpdate() {
        updatedAt = Instant.now();
    }

    // Getters and Setters
    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Long getCoacheeEmployeeId() { return coacheeEmployeeId; }
    public void setCoacheeEmployeeId(Long coacheeEmployeeId) { this.coacheeEmployeeId = coacheeEmployeeId; }

    public Long getCurrentCoachEmployeeId() { return currentCoachEmployeeId; }
    public void setCurrentCoachEmployeeId(Long currentCoachEmployeeId) { this.currentCoachEmployeeId = currentCoachEmployeeId; }

    public Long getAssignmentId() { return assignmentId; }
    public void setAssignmentId(Long assignmentId) { this.assignmentId = assignmentId; }

    public int getConsecutiveLowQuartersCount() { return consecutiveLowQuartersCount; }
    public void setConsecutiveLowQuartersCount(int consecutiveLowQuartersCount) { this.consecutiveLowQuartersCount = consecutiveLowQuartersCount; }

    public String getLatestScoresJson() { return latestScoresJson; }
    public void setLatestScoresJson(String latestScoresJson) { this.latestScoresJson = latestScoresJson; }

    public int getCoachingSessionsAttended() { return coachingSessionsAttended; }
    public void setCoachingSessionsAttended(int coachingSessionsAttended) { this.coachingSessionsAttended = coachingSessionsAttended; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public Long getNewCoachEmployeeId() { return newCoachEmployeeId; }
    public void setNewCoachEmployeeId(Long newCoachEmployeeId) { this.newCoachEmployeeId = newCoachEmployeeId; }

    public Long getPmsAdminUserId() { return pmsAdminUserId; }
    public void setPmsAdminUserId(Long pmsAdminUserId) { this.pmsAdminUserId = pmsAdminUserId; }

    public String getResolutionType() { return resolutionType; }
    public void setResolutionType(String resolutionType) { this.resolutionType = resolutionType; }

    public String getResolutionNotes() { return resolutionNotes; }
    public void setResolutionNotes(String resolutionNotes) { this.resolutionNotes = resolutionNotes; }

    public Instant getEscalatedAt() { return escalatedAt; }
    public void setEscalatedAt(Instant escalatedAt) { this.escalatedAt = escalatedAt; }

    public Instant getResolvedAt() { return resolvedAt; }
    public void setResolvedAt(Instant resolvedAt) { this.resolvedAt = resolvedAt; }

    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
}
