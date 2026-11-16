package com.boa.apid.mentoring.pairing.entity;

import com.boa.apid.core.authorization.entity.User;
import jakarta.persistence.*;

import java.time.Instant;

@Entity
@Table(name = "mentoring_request_recipients", schema = "mentoring")
public class MentoringRequestRecipient {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "request_id", nullable = false)
    private MentoringRequest request;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "recipient_user_id", nullable = false)
    private User recipientUser;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "trainee_user_id", nullable = false)
    private User traineeUser;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private MentoringRequestRecipientStatus status = MentoringRequestRecipientStatus.PENDING;

    @Column(name = "responded_at")
    private Instant respondedAt;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @PrePersist
    void onCreate() {
        if (createdAt == null) {
            createdAt = Instant.now();
        }
    }

    public Long getId() { return id; }
    public MentoringRequest getRequest() { return request; }
    public void setRequest(MentoringRequest request) { this.request = request; }
    public User getRecipientUser() { return recipientUser; }
    public void setRecipientUser(User recipientUser) { this.recipientUser = recipientUser; }
    public User getTraineeUser() { return traineeUser; }
    public void setTraineeUser(User traineeUser) { this.traineeUser = traineeUser; }
    public MentoringRequestRecipientStatus getStatus() { return status; }
    public void setStatus(MentoringRequestRecipientStatus status) { this.status = status; }
    public Instant getRespondedAt() { return respondedAt; }
    public void setRespondedAt(Instant respondedAt) { this.respondedAt = respondedAt; }
    public Instant getCreatedAt() { return createdAt; }
}
