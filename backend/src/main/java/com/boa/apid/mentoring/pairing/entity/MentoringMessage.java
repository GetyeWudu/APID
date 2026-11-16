package com.boa.apid.mentoring.pairing.entity;

import com.boa.apid.core.authorization.entity.User;
import jakarta.persistence.*;

import java.time.Instant;

@Entity
@Table(name = "mentoring_messages", schema = "mentoring")
public class MentoringMessage {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "relationship_id", nullable = false)
    private MentoringRelationship relationship;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "sender_user_id", nullable = false)
    private User senderUser;

    @Column(nullable = false, length = 4000)
    private String body;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @PrePersist
    void onCreate() {
        if (createdAt == null) {
            createdAt = Instant.now();
        }
    }

    public Long getId() { return id; }
    public MentoringRelationship getRelationship() { return relationship; }
    public void setRelationship(MentoringRelationship relationship) { this.relationship = relationship; }
    public User getSenderUser() { return senderUser; }
    public void setSenderUser(User senderUser) { this.senderUser = senderUser; }
    public String getBody() { return body; }
    public void setBody(String body) { this.body = body; }
    public Instant getCreatedAt() { return createdAt; }
}
