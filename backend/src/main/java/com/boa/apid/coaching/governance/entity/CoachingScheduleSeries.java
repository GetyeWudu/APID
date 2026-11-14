package com.boa.apid.coaching.governance.entity;

import com.boa.apid.coaching.session.entity.SessionMeetingMode;
import jakarta.persistence.*;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;

@Entity
@Table(name = "schedule_series", schema = "coaching")
public class CoachingScheduleSeries {

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
    @Column(name = "cadence_type", nullable = false, length = 30)
    private CadenceType cadenceType;

    @Column(name = "days_of_week", nullable = false, length = 60)
    private String daysOfWeek; // e.g., "TUESDAY" or "TUESDAY,THURSDAY"

    @Column(name = "preferred_start_time", nullable = false)
    private LocalTime preferredStartTime;

    @Column(name = "duration_minutes", nullable = false)
    private int durationMinutes;

    @Enumerated(EnumType.STRING)
    @Column(name = "meeting_mode", nullable = false, length = 30)
    private SessionMeetingMode meetingMode = SessionMeetingMode.VIRTUAL_VIDEO;

    @Column(name = "meeting_location", length = 255)
    private String meetingLocation;

    @Column(name = "first_session_date", nullable = false)
    private LocalDate firstSessionDate;

    @Column(name = "target_occurrences", nullable = false)
    private int targetOccurrences;

    @Column(name = "generated_occurrences", nullable = false)
    private int generatedOccurrences;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 30)
    private SeriesStatus status = SeriesStatus.ACTIVE;

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

    public CadenceType getCadenceType() { return cadenceType; }
    public void setCadenceType(CadenceType cadenceType) { this.cadenceType = cadenceType; }

    public String getDaysOfWeek() { return daysOfWeek; }
    public void setDaysOfWeek(String daysOfWeek) { this.daysOfWeek = daysOfWeek; }

    public LocalTime getPreferredStartTime() { return preferredStartTime; }
    public void setPreferredStartTime(LocalTime preferredStartTime) { this.preferredStartTime = preferredStartTime; }

    public int getDurationMinutes() { return durationMinutes; }
    public void setDurationMinutes(int durationMinutes) { this.durationMinutes = durationMinutes; }

    public SessionMeetingMode getMeetingMode() { return meetingMode; }
    public void setMeetingMode(SessionMeetingMode meetingMode) { this.meetingMode = meetingMode; }

    public String getMeetingLocation() { return meetingLocation; }
    public void setMeetingLocation(String meetingLocation) { this.meetingLocation = meetingLocation; }

    public LocalDate getFirstSessionDate() { return firstSessionDate; }
    public void setFirstSessionDate(LocalDate firstSessionDate) { this.firstSessionDate = firstSessionDate; }

    public int getTargetOccurrences() { return targetOccurrences; }
    public void setTargetOccurrences(int targetOccurrences) { this.targetOccurrences = targetOccurrences; }

    public int getGeneratedOccurrences() { return generatedOccurrences; }
    public void setGeneratedOccurrences(int generatedOccurrences) { this.generatedOccurrences = generatedOccurrences; }

    public SeriesStatus getStatus() { return status; }
    public void setStatus(SeriesStatus status) { this.status = status; }

    public Long getCreatedByUserId() { return createdByUserId; }
    public void setCreatedByUserId(Long createdByUserId) { this.createdByUserId = createdByUserId; }

    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
}

