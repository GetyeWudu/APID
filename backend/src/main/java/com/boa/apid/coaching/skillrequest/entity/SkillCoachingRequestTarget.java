package com.boa.apid.coaching.skillrequest.entity;

import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(name = "skill_coaching_request_targets", schema = "coaching")
public class SkillCoachingRequestTarget {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "request_id", nullable = false)
    private SkillCoachingRequest request;

    @Column(name = "employee_id", nullable = false)
    private Long employeeId;

    @Column(name = "created_assignment_id")
    private Long createdAssignmentId;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @PrePersist
    void onCreate() {
        this.createdAt = Instant.now();
    }

    public Long getId() { return id; }
    public SkillCoachingRequest getRequest() { return request; }
    public void setRequest(SkillCoachingRequest request) { this.request = request; }
    public Long getEmployeeId() { return employeeId; }
    public void setEmployeeId(Long employeeId) { this.employeeId = employeeId; }
    public Long getCreatedAssignmentId() { return createdAssignmentId; }
    public void setCreatedAssignmentId(Long createdAssignmentId) { this.createdAssignmentId = createdAssignmentId; }
    public Instant getCreatedAt() { return createdAt; }
}

