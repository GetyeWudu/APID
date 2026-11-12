package com.boa.apid.coaching.assignment.entity;

import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(name = "coaching_assignments", schema = "coaching")
public class CoachingAssignment {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Enumerated(EnumType.STRING)
    @Column(name = "pathway", nullable = false, length = 30)
    private AssignmentPathway pathway;

    @Column(name = "coachee_employee_id", nullable = false)
    private Long coacheeEmployeeId;

    @Column(name = "coach_employee_id")
    private Long coachEmployeeId;

    @Column(name = "performance_record_id")
    private Long performanceRecordId;

    @Column(name = "performance_fiscal_quarter_id", nullable = false)
    private Long performanceFiscalQuarterId;

    @Column(name = "coaching_fiscal_quarter_id", nullable = false)
    private Long coachingFiscalQuarterId;

    @Column(name = "previous_assignment_id")
    private Long previousAssignmentId;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 30)
    private AssignmentStatus status = AssignmentStatus.ACTIVE;

    @Enumerated(EnumType.STRING)
    @Column(name = "closure_reason", length = 30)
    private AssignmentClosureReason closureReason;

    @Column(name = "at_risk", nullable = false)
    private boolean atRisk = false;

    @Column(name = "missed_sessions_count", nullable = false)
    private int missedSessionsCount = 0;

    @Column(name = "last_activity_at")
    private Instant lastActivityAt;

    @Column(name = "closed_at")
    private Instant closedAt;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @PrePersist
    void onCreate() {
        Instant now = Instant.now();
        this.createdAt = now;
        this.updatedAt = now;
    }

    @PreUpdate
    void onUpdate() { this.updatedAt = Instant.now(); }

    // ---- Getters and Setters ----

    public Long getId() { return id; }
    public AssignmentPathway getPathway() { return pathway; }
    public void setPathway(AssignmentPathway pathway) { this.pathway = pathway; }
    public Long getCoacheeEmployeeId() { return coacheeEmployeeId; }
    public void setCoacheeEmployeeId(Long coacheeEmployeeId) { this.coacheeEmployeeId = coacheeEmployeeId; }
    public Long getCoachEmployeeId() { return coachEmployeeId; }
    public void setCoachEmployeeId(Long coachEmployeeId) { this.coachEmployeeId = coachEmployeeId; }
    public Long getPerformanceRecordId() { return performanceRecordId; }
    public void setPerformanceRecordId(Long performanceRecordId) { this.performanceRecordId = performanceRecordId; }
    public Long getPerformanceFiscalQuarterId() { return performanceFiscalQuarterId; }
    public void setPerformanceFiscalQuarterId(Long performanceFiscalQuarterId) { this.performanceFiscalQuarterId = performanceFiscalQuarterId; }
    public Long getCoachingFiscalQuarterId() { return coachingFiscalQuarterId; }
    public void setCoachingFiscalQuarterId(Long coachingFiscalQuarterId) { this.coachingFiscalQuarterId = coachingFiscalQuarterId; }
    public Long getPreviousAssignmentId() { return previousAssignmentId; }
    public void setPreviousAssignmentId(Long previousAssignmentId) { this.previousAssignmentId = previousAssignmentId; }
    public AssignmentStatus getStatus() { return status; }
    public void setStatus(AssignmentStatus status) { this.status = status; }
    public AssignmentClosureReason getClosureReason() { return closureReason; }
    public void setClosureReason(AssignmentClosureReason closureReason) { this.closureReason = closureReason; }
    public boolean isAtRisk() { return atRisk; }
    public void setAtRisk(boolean atRisk) { this.atRisk = atRisk; }
    public int getMissedSessionsCount() { return missedSessionsCount; }
    public void setMissedSessionsCount(int missedSessionsCount) { this.missedSessionsCount = missedSessionsCount; }
    public Instant getLastActivityAt() { return lastActivityAt; }
    public void setLastActivityAt(Instant lastActivityAt) { this.lastActivityAt = lastActivityAt; }
    public Instant getClosedAt() { return closedAt; }
    public void setClosedAt(Instant closedAt) { this.closedAt = closedAt; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
}

