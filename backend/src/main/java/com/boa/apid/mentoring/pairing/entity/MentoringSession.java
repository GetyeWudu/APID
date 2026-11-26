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

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "target_trainee_member_id")
    private MentoringRelationshipMember targetTraineeMember;

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

    @Column(name = "meeting_provider", length = 30)
    private String meetingProvider = "LIVEKIT";

    @Column(name = "is_group_session", nullable = false)
    private boolean isGroupSession = false;

    @Column(name = "meeting_room_name", length = 120)
    private String meetingRoomName;

    @Column(name = "meeting_room_url", columnDefinition = "TEXT")
    private String meetingRoomUrl;

    @Column(length = 255)
    private String location;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private MentoringSessionStatus status = MentoringSessionStatus.PENDING;

    @Column(name = "decline_reason", columnDefinition = "TEXT")
    private String declineReason;

    @Column(name = "reschedule_reason", columnDefinition = "TEXT")
    private String rescheduleReason;

    @Column(name = "proposed_start")
    private Instant proposedStart;

    @Column(name = "proposed_end")
    private Instant proposedEnd;

    @Column(name = "proposed_by_user_id")
    private Long proposedByUserId;

    @Column(name = "responded_at")
    private Instant respondedAt;

    @Column(name = "cancellation_reason", columnDefinition = "TEXT")
    private String cancellationReason;

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
    public MentoringRelationshipMember getTargetTraineeMember() { return targetTraineeMember; }
    public void setTargetTraineeMember(MentoringRelationshipMember targetTraineeMember) {
        this.targetTraineeMember = targetTraineeMember;
    }
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
    public String getMeetingUrl() { return meetingRoomUrl != null ? meetingRoomUrl : meetingUrl; }
    public void setMeetingUrl(String meetingUrl) {
        this.meetingUrl = meetingUrl;
        if (this.meetingRoomUrl == null) this.meetingRoomUrl = meetingUrl;
    }
    public String getMeetingProvider() { return meetingProvider; }
    public void setMeetingProvider(String meetingProvider) { this.meetingProvider = meetingProvider; }
    public boolean isGroupSession() { return isGroupSession; }
    public void setGroupSession(boolean groupSession) { isGroupSession = groupSession; }
    public String getMeetingRoomName() { return meetingRoomName; }
    public void setMeetingRoomName(String meetingRoomName) { this.meetingRoomName = meetingRoomName; }
    public String getMeetingRoomUrl() { return meetingRoomUrl != null ? meetingRoomUrl : meetingUrl; }
    public void setMeetingRoomUrl(String meetingRoomUrl) {
        this.meetingRoomUrl = meetingRoomUrl;
        this.meetingUrl = meetingRoomUrl;
    }
    public String getLocation() { return location; }
    public void setLocation(String location) { this.location = location; }
    public MentoringSessionStatus getStatus() { return status; }
    public void setStatus(MentoringSessionStatus status) { this.status = status; }
    public String getDeclineReason() { return declineReason; }
    public void setDeclineReason(String declineReason) { this.declineReason = declineReason; }
    public String getRescheduleReason() { return rescheduleReason; }
    public void setRescheduleReason(String rescheduleReason) { this.rescheduleReason = rescheduleReason; }
    public Instant getProposedStart() { return proposedStart; }
    public void setProposedStart(Instant proposedStart) { this.proposedStart = proposedStart; }
    public Instant getProposedEnd() { return proposedEnd; }
    public void setProposedEnd(Instant proposedEnd) { this.proposedEnd = proposedEnd; }
    public Long getProposedByUserId() { return proposedByUserId; }
    public void setProposedByUserId(Long proposedByUserId) { this.proposedByUserId = proposedByUserId; }
    public Instant getRespondedAt() { return respondedAt; }
    public void setRespondedAt(Instant respondedAt) { this.respondedAt = respondedAt; }
    public String getCancellationReason() { return cancellationReason; }
    public void setCancellationReason(String cancellationReason) { this.cancellationReason = cancellationReason; }
    public String getNotes() { return notes; }
    public void setNotes(String notes) { this.notes = notes; }
    public User getCreatedByUser() { return createdByUser; }
    public void setCreatedByUser(User createdByUser) { this.createdByUser = createdByUser; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
}
