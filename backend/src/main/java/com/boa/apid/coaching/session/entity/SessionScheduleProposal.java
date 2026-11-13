package com.boa.apid.coaching.session.entity;

import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(name = "session_schedule_proposals", schema = "coaching")
public class SessionScheduleProposal {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "session_id", nullable = false)
    private Long sessionId;

    @Column(name = "proposed_by_employee_id", nullable = false)
    private Long proposedByEmployeeId;

    @Column(name = "proposed_start_time", nullable = false)
    private Instant proposedStartTime;

    @Column(name = "proposed_end_time", nullable = false)
    private Instant proposedEndTime;

    @Column(name = "reason", nullable = false, columnDefinition = "TEXT")
    private String reason;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 30)
    private ProposalStatus status = ProposalStatus.PENDING;

    @Column(name = "responded_by_employee_id")
    private Long respondedByEmployeeId;

    @Column(name = "responded_at")
    private Instant respondedAt;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @PrePersist
    void onCreate() {
        this.createdAt = Instant.now();
    }

    // Getters and Setters
    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Long getSessionId() { return sessionId; }
    public void setSessionId(Long sessionId) { this.sessionId = sessionId; }

    public Long getProposedByEmployeeId() { return proposedByEmployeeId; }
    public void setProposedByEmployeeId(Long proposedByEmployeeId) { this.proposedByEmployeeId = proposedByEmployeeId; }

    public Instant getProposedStartTime() { return proposedStartTime; }
    public void setProposedStartTime(Instant proposedStartTime) { this.proposedStartTime = proposedStartTime; }

    public Instant getProposedEndTime() { return proposedEndTime; }
    public void setProposedEndTime(Instant proposedEndTime) { this.proposedEndTime = proposedEndTime; }

    public String getReason() { return reason; }
    public void setReason(String reason) { this.reason = reason; }

    public ProposalStatus getStatus() { return status; }
    public void setStatus(ProposalStatus status) { this.status = status; }

    public Long getRespondedByEmployeeId() { return respondedByEmployeeId; }
    public void setRespondedByEmployeeId(Long respondedByEmployeeId) { this.respondedByEmployeeId = respondedByEmployeeId; }

    public Instant getRespondedAt() { return respondedAt; }
    public void setRespondedAt(Instant respondedAt) { this.respondedAt = respondedAt; }

    public Instant getCreatedAt() { return createdAt; }
}

