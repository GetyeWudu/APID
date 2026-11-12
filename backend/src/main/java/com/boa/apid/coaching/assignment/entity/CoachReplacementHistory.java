package com.boa.apid.coaching.assignment.entity;

import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(name = "coach_replacement_history", schema = "coaching")
public class CoachReplacementHistory {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "assignment_id", nullable = false)
    private Long assignmentId;

    @Column(name = "previous_coach_employee_id")
    private Long previousCoachEmployeeId;

    @Column(name = "new_coach_employee_id", nullable = false)
    private Long newCoachEmployeeId;

    @Column(name = "reason", nullable = false, length = 500)
    private String reason;

    @Column(name = "changed_by_user_id", nullable = false)
    private Long changedByUserId;

    @Column(name = "changed_at", nullable = false, updatable = false)
    private Instant changedAt;

    @PrePersist
    void onCreate() { this.changedAt = Instant.now(); }

    public Long getId() { return id; }
    public Long getAssignmentId() { return assignmentId; }
    public void setAssignmentId(Long assignmentId) { this.assignmentId = assignmentId; }
    public Long getPreviousCoachEmployeeId() { return previousCoachEmployeeId; }
    public void setPreviousCoachEmployeeId(Long previousCoachEmployeeId) { this.previousCoachEmployeeId = previousCoachEmployeeId; }
    public Long getNewCoachEmployeeId() { return newCoachEmployeeId; }
    public void setNewCoachEmployeeId(Long newCoachEmployeeId) { this.newCoachEmployeeId = newCoachEmployeeId; }
    public String getReason() { return reason; }
    public void setReason(String reason) { this.reason = reason; }
    public Long getChangedByUserId() { return changedByUserId; }
    public void setChangedByUserId(Long changedByUserId) { this.changedByUserId = changedByUserId; }
    public Instant getChangedAt() { return changedAt; }
}

