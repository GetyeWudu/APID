package com.boa.apid.coaching.communication.entity;

import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(name = "conversations", schema = "core")
public class CoachingConversation {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Enumerated(EnumType.STRING)
    @Column(name = "conversation_type", nullable = false, length = 20)
    private ConversationType conversationType;

    @Enumerated(EnumType.STRING)
    @Column(name = "context_type", nullable = false, length = 30)
    private ConversationContextType contextType;

    @Column(name = "assignment_id")
    private Long assignmentId;

    @Column(name = "skill_request_id")
    private Long skillRequestId;

    @Column(name = "mentoring_relationship_id")
    private Long mentoringRelationshipId;

    @Column(name = "skill_id")
    private Long skillId;

    @Column(name = "peer_employee_a_id")
    private Long peerEmployeeAId;

    @Column(name = "peer_employee_b_id")
    private Long peerEmployeeBId;

    @Column(name = "title", nullable = false, length = 200)
    private String title;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 20)
    private ConversationStatus status = ConversationStatus.ACTIVE;

    @Column(name = "created_by_user_id")
    private Long createdByUserId;

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
    void onUpdate() {
        this.updatedAt = Instant.now();
    }

    // ---- Getters and Setters ----

    public Long getId() { return id; }
    public ConversationType getConversationType() { return conversationType; }
    public void setConversationType(ConversationType conversationType) { this.conversationType = conversationType; }
    public ConversationContextType getContextType() { return contextType; }
    public void setContextType(ConversationContextType contextType) { this.contextType = contextType; }
    public Long getAssignmentId() { return assignmentId; }
    public void setAssignmentId(Long assignmentId) { this.assignmentId = assignmentId; }
    public Long getSkillRequestId() { return skillRequestId; }
    public void setSkillRequestId(Long skillRequestId) { this.skillRequestId = skillRequestId; }
    public Long getMentoringRelationshipId() { return mentoringRelationshipId; }
    public void setMentoringRelationshipId(Long mentoringRelationshipId) { this.mentoringRelationshipId = mentoringRelationshipId; }
    public Long getSkillId() { return skillId; }
    public void setSkillId(Long skillId) { this.skillId = skillId; }
    public Long getPeerEmployeeAId() { return peerEmployeeAId; }
    public void setPeerEmployeeAId(Long peerEmployeeAId) { this.peerEmployeeAId = peerEmployeeAId; }
    public Long getPeerEmployeeBId() { return peerEmployeeBId; }
    public void setPeerEmployeeBId(Long peerEmployeeBId) { this.peerEmployeeBId = peerEmployeeBId; }
    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }
    public ConversationStatus getStatus() { return status; }
    public void setStatus(ConversationStatus status) { this.status = status; }
    public Long getCreatedByUserId() { return createdByUserId; }
    public void setCreatedByUserId(Long createdByUserId) { this.createdByUserId = createdByUserId; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Instant updatedAt) { this.updatedAt = updatedAt; }
}
