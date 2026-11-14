package com.boa.apid.mentoring.pairing.entity;

import com.boa.apid.core.authorization.entity.User;
import jakarta.persistence.*;

import java.time.Instant;

@Entity
@Table(name = "mentoring_relationship_members", schema = "mentoring")
public class MentoringRelationshipMember {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "relationship_id", nullable = false)
    private MentoringRelationship relationship;

    @OneToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "request_recipient_id", nullable = false, unique = true)
    private MentoringRequestRecipient requestRecipient;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "mentor_user_id", nullable = false)
    private User mentorUser;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "trainee_user_id", nullable = false)
    private User traineeUser;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private MentoringRelationshipMemberStatus status = MentoringRelationshipMemberStatus.ACTIVE;

    @Column(name = "joined_at", nullable = false, updatable = false)
    private Instant joinedAt;

    @Column(name = "ended_at")
    private Instant endedAt;

    @PrePersist
    void onCreate() {
        if (joinedAt == null) {
            joinedAt = Instant.now();
        }
    }

    public Long getId() { return id; }
    public MentoringRelationship getRelationship() { return relationship; }
    public void setRelationship(MentoringRelationship relationship) { this.relationship = relationship; }
    public MentoringRequestRecipient getRequestRecipient() { return requestRecipient; }
    public void setRequestRecipient(MentoringRequestRecipient requestRecipient) { this.requestRecipient = requestRecipient; }
    public User getMentorUser() { return mentorUser; }
    public void setMentorUser(User mentorUser) { this.mentorUser = mentorUser; }
    public User getTraineeUser() { return traineeUser; }
    public void setTraineeUser(User traineeUser) { this.traineeUser = traineeUser; }
    public MentoringRelationshipMemberStatus getStatus() { return status; }
    public void setStatus(MentoringRelationshipMemberStatus status) { this.status = status; }
    public Instant getJoinedAt() { return joinedAt; }
    public Instant getEndedAt() { return endedAt; }
    public void setEndedAt(Instant endedAt) { this.endedAt = endedAt; }
}
