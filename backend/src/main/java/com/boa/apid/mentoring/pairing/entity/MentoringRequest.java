package com.boa.apid.mentoring.pairing.entity;

import com.boa.apid.core.authorization.entity.User;
import com.boa.apid.core.skills.entity.Skill;
import jakarta.persistence.*;

import java.time.Instant;

@Entity
@Table(name = "mentoring_requests", schema = "mentoring")
public class MentoringRequest {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "mentor_user_id", nullable = false)
    private User mentorUser;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "initiated_by_user_id", nullable = false)
    private User initiatedByUser;

    @Enumerated(EnumType.STRING)
    @Column(name = "request_type", nullable = false, length = 20)
    private MentoringRequestType requestType;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "skill_id")
    private Skill skill;

    @Column(length = 1000)
    private String message;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @PrePersist
    void onCreate() {
        if (createdAt == null) {
            createdAt = Instant.now();
        }
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public User getMentorUser() { return mentorUser; }
    public void setMentorUser(User mentorUser) { this.mentorUser = mentorUser; }
    public User getInitiatedByUser() { return initiatedByUser; }
    public void setInitiatedByUser(User initiatedByUser) { this.initiatedByUser = initiatedByUser; }
    public MentoringRequestType getRequestType() { return requestType; }
    public void setRequestType(MentoringRequestType requestType) { this.requestType = requestType; }
    public Skill getSkill() { return skill; }
    public void setSkill(Skill skill) { this.skill = skill; }
    public String getMessage() { return message; }
    public void setMessage(String message) { this.message = message; }
    public Instant getCreatedAt() { return createdAt; }
}
