package com.boa.apid.coaching.communication.entity;

import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(name = "conversation_participants", schema = "coaching")
public class ConversationParticipant {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "conversation_id", nullable = false)
    private Long conversationId;

    @Column(name = "employee_id", nullable = false)
    private Long employeeId;

    @Column(name = "user_id")
    private Long userId;

    @Enumerated(EnumType.STRING)
    @Column(name = "role", nullable = false, length = 20)
    private ConversationParticipantRole role;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 20)
    private ParticipantStatus status = ParticipantStatus.ACTIVE;

    @Column(name = "joined_at", nullable = false)
    private Instant joinedAt;

    @Column(name = "left_at")
    private Instant leftAt;

    @Column(name = "removed_by_user_id")
    private Long removedByUserId;

    @Column(name = "removal_reason", columnDefinition = "TEXT")
    private String removalReason;

    @PrePersist
    void onCreate() {
        if (this.joinedAt == null) {
            this.joinedAt = Instant.now();
        }
    }

    public ConversationParticipant() {}

    public ConversationParticipant(Long conversationId, Long employeeId, Long userId, ConversationParticipantRole role) {
        this.conversationId = conversationId;
        this.employeeId = employeeId;
        this.userId = userId;
        this.role = role;
        this.status = ParticipantStatus.ACTIVE;
        this.joinedAt = Instant.now();
    }

    // ---- Getters and Setters ----

    public Long getId() { return id; }
    public Long getConversationId() { return conversationId; }
    public void setConversationId(Long conversationId) { this.conversationId = conversationId; }
    public Long getEmployeeId() { return employeeId; }
    public void setEmployeeId(Long employeeId) { this.employeeId = employeeId; }
    public Long getUserId() { return userId; }
    public void setUserId(Long userId) { this.userId = userId; }
    public ConversationParticipantRole getRole() { return role; }
    public void setRole(ConversationParticipantRole role) { this.role = role; }
    public ParticipantStatus getStatus() { return status; }
    public void setStatus(ParticipantStatus status) { this.status = status; }
    public Instant getJoinedAt() { return joinedAt; }
    public void setJoinedAt(Instant joinedAt) { this.joinedAt = joinedAt; }
    public Instant getLeftAt() { return leftAt; }
    public void setLeftAt(Instant leftAt) { this.leftAt = leftAt; }
    public Long getRemovedByUserId() { return removedByUserId; }
    public void setRemovedByUserId(Long removedByUserId) { this.removedByUserId = removedByUserId; }
    public String getRemovalReason() { return removalReason; }
    public void setRemovalReason(String removalReason) { this.removalReason = removalReason; }
}
