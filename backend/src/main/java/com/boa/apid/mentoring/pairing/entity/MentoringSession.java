package com.boa.apid.mentoring.pairing.entity;

import com.boa.apid.core.authorization.entity.User;
import jakarta.persistence.*;

import java.time.Instant;

@Entity
@Table(name = "mentoring_sessions", schema = "mentoring")
public class MentoringSession {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "relationship_id", nullable = false)
    private MentoringRelationship relationship;

    @Column(nullable = false, length = 180)
    private String title;

    @Column(length = 2000)
    private String agenda;

    @Column(name = "scheduled_start", nullable = false)
    private Instant scheduledStart;

    @Column(name = "scheduled_end", nullable = false)
    private Instant scheduledEnd;

    @Enumerated(EnumType.STRING)
    @Column(name = "delivery_mode", nullable = false, length = 20)
    private MentoringDeliveryMode deliveryMode;

    @Column(name = "meeting_url", length = 1000)
    private String meetingUrl;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private MentoringSessionStatus status = MentoringSessionStatus.SCHEDULED;

    @Column(length = 4000)
    private String notes;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "created_by_user_id", nullable = false)
    private User createdByUser;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @PrePersist
    void onCreate() {
        Instant now = Instant.now();
        if (createdAt == null) {
            createdAt = now;
        }
        updatedAt = now;
    }

    @PreUpdate
    void onUpdate() {
        updatedAt = Instant.now();
    }

    public Long getId() { return id; }
    public MentoringRelationship getRelationship() { return relationship; }
    public void setRelationship(MentoringRelationship relationship) { this.relationship = relationship; }
    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }
    public String getAgenda() { return agenda; }
    public void setAgenda(String agenda) { this.agenda = agenda; }
    public Instant getScheduledStart() { return scheduledStart; }
    public void setScheduledStart(Instant scheduledStart) { this.scheduledStart = scheduledStart; }
    public Instant getScheduledEnd() { return scheduledEnd; }
    public void setScheduledEnd(Instant scheduledEnd) { this.scheduledEnd = scheduledEnd; }
    public MentoringDeliveryMode getDeliveryMode() { return deliveryMode; }
    public void setDeliveryMode(MentoringDeliveryMode deliveryMode) { this.deliveryMode = deliveryMode; }
    public String getMeetingUrl() { return meetingUrl; }
    public void setMeetingUrl(String meetingUrl) { this.meetingUrl = meetingUrl; }
    public MentoringSessionStatus getStatus() { return status; }
    public String getNotes() { return notes; }
    public User getCreatedByUser() { return createdByUser; }
    public void setCreatedByUser(User createdByUser) { this.createdByUser = createdByUser; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
}
