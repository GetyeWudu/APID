package com.boa.apid.coaching.session.entity;

import com.boa.apid.coaching.assignment.entity.AssignmentPathway;
import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(name = "coaching_sessions", schema = "coaching")
public class CoachingSession {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "assignment_id")
    private Long assignmentId;

    @Column(name = "skill_request_id")
    private Long skillRequestId;

    @Column(name = "coach_employee_id", nullable = false)
    private Long coachEmployeeId;

    @Column(name = "title", nullable = false, length = 200)
    private String title;

    @Enumerated(EnumType.STRING)
    @Column(name = "pathway", nullable = false, length = 30)
    private AssignmentPathway pathway;

    @Column(name = "scheduled_start_time", nullable = false)
    private Instant scheduledStartTime;

    @Column(name = "scheduled_end_time", nullable = false)
    private Instant scheduledEndTime;

    @Column(name = "duration_minutes", nullable = false)
    private int durationMinutes;

    @Enumerated(EnumType.STRING)
    @Column(name = "meeting_mode", nullable = false, length = 30)
    private SessionMeetingMode meetingMode = SessionMeetingMode.VIRTUAL_VIDEO;

    @Column(name = "meeting_location", length = 255)
    private String meetingLocation;

    @Column(name = "daily_room_name", length = 120)
    private String dailyRoomName;

    @Column(name = "daily_room_url", columnDefinition = "TEXT")
    private String dailyRoomUrl;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 30)
    private SessionStatus status = SessionStatus.PROPOSED;

    @Column(name = "cancellation_reason", columnDefinition = "TEXT")
    private String cancellationReason;

    @Column(name = "cancelled_by_employee_id")
    private Long cancelledByEmployeeId;

    @Column(name = "cancelled_at")
    private Instant cancelledAt;

    @Column(name = "target_pms_goal_id")
    private Long targetPmsGoalId;

    @Column(name = "session_notes_minutes", columnDefinition = "TEXT")
    private String sessionNotesMinutes;

    @Column(name = "action_items", columnDefinition = "TEXT")
    private String actionItems;

    @Column(name = "conducted_at")
    private Instant conductedAt;

    @Column(name = "created_by_user_id", nullable = false)
    private Long createdByUserId;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @PrePersist
    void onCreate() {
        this.createdAt = Instant.now();
        this.updatedAt = Instant.now();
    }

    @PreUpdate
    void onUpdate() {
        this.updatedAt = Instant.now();
    }

    // Getters and Setters
    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Long getAssignmentId() { return assignmentId; }
    public void setAssignmentId(Long assignmentId) { this.assignmentId = assignmentId; }

    public Long getSkillRequestId() { return skillRequestId; }
    public void setSkillRequestId(Long skillRequestId) { this.skillRequestId = skillRequestId; }

    public Long getCoachEmployeeId() { return coachEmployeeId; }
    public void setCoachEmployeeId(Long coachEmployeeId) { this.coachEmployeeId = coachEmployeeId; }

    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }

    public AssignmentPathway getPathway() { return pathway; }
    public void setPathway(AssignmentPathway pathway) { this.pathway = pathway; }

    public Instant getScheduledStartTime() { return scheduledStartTime; }
    public void setScheduledStartTime(Instant scheduledStartTime) { this.scheduledStartTime = scheduledStartTime; }

    public Instant getScheduledEndTime() { return scheduledEndTime; }
    public void setScheduledEndTime(Instant scheduledEndTime) { this.scheduledEndTime = scheduledEndTime; }

    public int getDurationMinutes() { return durationMinutes; }
    public void setDurationMinutes(int durationMinutes) { this.durationMinutes = durationMinutes; }

    public SessionMeetingMode getMeetingMode() { return meetingMode; }
    public void setMeetingMode(SessionMeetingMode meetingMode) { this.meetingMode = meetingMode; }

    public String getMeetingLocation() { return meetingLocation; }
    public void setMeetingLocation(String meetingLocation) { this.meetingLocation = meetingLocation; }

    public String getDailyRoomName() { return dailyRoomName; }
    public void setDailyRoomName(String dailyRoomName) { this.dailyRoomName = dailyRoomName; }

    public String getDailyRoomUrl() { return dailyRoomUrl; }
    public void setDailyRoomUrl(String dailyRoomUrl) { this.dailyRoomUrl = dailyRoomUrl; }

    public SessionStatus getStatus() { return status; }
    public void setStatus(SessionStatus status) { this.status = status; }

    public String getCancellationReason() { return cancellationReason; }
    public void setCancellationReason(String cancellationReason) { this.cancellationReason = cancellationReason; }

    public Long getCancelledByEmployeeId() { return cancelledByEmployeeId; }
    public void setCancelledByEmployeeId(Long cancelledByEmployeeId) { this.cancelledByEmployeeId = cancelledByEmployeeId; }

    public Instant getCancelledAt() { return cancelledAt; }
    public void setCancelledAt(Instant cancelledAt) { this.cancelledAt = cancelledAt; }

    public Long getTargetPmsGoalId() { return targetPmsGoalId; }
    public void setTargetPmsGoalId(Long targetPmsGoalId) { this.targetPmsGoalId = targetPmsGoalId; }

    public String getSessionNotesMinutes() { return sessionNotesMinutes; }
    public void setSessionNotesMinutes(String sessionNotesMinutes) { this.sessionNotesMinutes = sessionNotesMinutes; }

    public String getActionItems() { return actionItems; }
    public void setActionItems(String actionItems) { this.actionItems = actionItems; }

    public Instant getConductedAt() { return conductedAt; }
    public void setConductedAt(Instant conductedAt) { this.conductedAt = conductedAt; }

    public Long getCreatedByUserId() { return createdByUserId; }
    public void setCreatedByUserId(Long createdByUserId) { this.createdByUserId = createdByUserId; }

    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
}

