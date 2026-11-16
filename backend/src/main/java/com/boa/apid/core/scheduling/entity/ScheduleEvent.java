package com.boa.apid.core.scheduling.entity;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "schedule_events", schema = "core")
public class ScheduleEvent {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "source_module", nullable = false, length = 30)
    private String sourceModule; // e.g., 'COACHING', 'MENTORING'

    @Column(name = "source_session_id", nullable = false)
    private Long sourceSessionId;

    @Column(name = "title", nullable = false, length = 255)
    private String title;

    @Column(name = "start_at", nullable = false)
    private Instant startAt;

    @Column(name = "end_at", nullable = false)
    private Instant endAt;

    @Column(name = "timezone", nullable = false, length = 50)
    private String timezone = "Africa/Addis_Ababa";

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 30)
    private ScheduleEventStatus status = ScheduleEventStatus.CONFIRMED;

    @Column(name = "meeting_mode", length = 30)
    private String meetingMode;

    @Column(name = "meeting_location", length = 255)
    private String meetingLocation;

    @Column(name = "video_call_url", columnDefinition = "TEXT")
    private String videoCallUrl;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt = Instant.now();

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt = Instant.now();

    @OneToMany(mappedBy = "scheduleEvent", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.LAZY)
    private List<ScheduleParticipant> participants = new ArrayList<>();

    public ScheduleEvent() {}

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getSourceModule() { return sourceModule; }
    public void setSourceModule(String sourceModule) { this.sourceModule = sourceModule; }

    public Long getSourceSessionId() { return sourceSessionId; }
    public void setSourceSessionId(Long sourceSessionId) { this.sourceSessionId = sourceSessionId; }

    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }

    public Instant getStartAt() { return startAt; }
    public void setStartAt(Instant startAt) { this.startAt = startAt; }

    public Instant getEndAt() { return endAt; }
    public void setEndAt(Instant endAt) { this.endAt = endAt; }

    public String getTimezone() { return timezone; }
    public void setTimezone(String timezone) { this.timezone = timezone; }

    public ScheduleEventStatus getStatus() { return status; }
    public void setStatus(ScheduleEventStatus status) { this.status = status; }

    public String getMeetingMode() { return meetingMode; }
    public void setMeetingMode(String meetingMode) { this.meetingMode = meetingMode; }

    public String getMeetingLocation() { return meetingLocation; }
    public void setMeetingLocation(String meetingLocation) { this.meetingLocation = meetingLocation; }

    public String getVideoCallUrl() { return videoCallUrl; }
    public void setVideoCallUrl(String videoCallUrl) { this.videoCallUrl = videoCallUrl; }

    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }

    public List<ScheduleParticipant> getParticipants() { return participants; }
    public void setParticipants(List<ScheduleParticipant> participants) { this.participants = participants; }

    public void addParticipant(ScheduleParticipant p) {
        p.setScheduleEvent(this);
        this.participants.add(p);
    }

    @PreUpdate
    public void preUpdate() {
        this.updatedAt = Instant.now();
    }
}

