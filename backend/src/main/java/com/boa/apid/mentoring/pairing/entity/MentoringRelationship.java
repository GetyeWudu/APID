package com.boa.apid.mentoring.pairing.entity;

import com.boa.apid.core.authorization.entity.User;
import jakarta.persistence.*;

import java.time.Instant;

@Entity
@Table(name = "mentoring_relationships", schema = "mentoring")
public class MentoringRelationship {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @OneToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "request_id", nullable = false, unique = true)
    private MentoringRequest request;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "mentor_user_id", nullable = false)
    private User mentorUser;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private MentoringRelationshipStatus status = MentoringRelationshipStatus.ACTIVE;

    @Column(name = "started_at", nullable = false, updatable = false)
    private Instant startedAt;

    @Column(name = "ended_at")
    private Instant endedAt;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @PrePersist
    void onCreate() {
        Instant now = Instant.now();
        if (startedAt == null) {
            startedAt = now;
        }
        if (createdAt == null) {
            createdAt = now;
        }
    }

    public Long getId() { return id; }
    public MentoringRequest getRequest() { return request; }
    public void setRequest(MentoringRequest request) { this.request = request; }
    public User getMentorUser() { return mentorUser; }
    public void setMentorUser(User mentorUser) { this.mentorUser = mentorUser; }
    public MentoringRelationshipStatus getStatus() { return status; }
    public void setStatus(MentoringRelationshipStatus status) { this.status = status; }
    public Instant getStartedAt() { return startedAt; }
    public Instant getEndedAt() { return endedAt; }
    public void setEndedAt(Instant endedAt) { this.endedAt = endedAt; }
}
