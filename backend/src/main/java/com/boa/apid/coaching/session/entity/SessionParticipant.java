package com.boa.apid.coaching.session.entity;

import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(name = "session_participants", schema = "coaching")
public class SessionParticipant {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "session_id", nullable = false)
    private Long sessionId;

    @Column(name = "employee_id", nullable = false)
    private Long employeeId;

    @Enumerated(EnumType.STRING)
    @Column(name = "role", nullable = false, length = 20)
    private ParticipantRole role;

    @Enumerated(EnumType.STRING)
    @Column(name = "invitation_status", nullable = false, length = 30)
    private InvitationStatus invitationStatus = InvitationStatus.PENDING;

    @Column(name = "invitation_decline_reason", columnDefinition = "TEXT")
    private String invitationDeclineReason;

    @Column(name = "responded_at")
    private Instant respondedAt;

    @Enumerated(EnumType.STRING)
    @Column(name = "attendance_status", nullable = false, length = 30)
    private AttendanceStatus attendanceStatus = AttendanceStatus.PENDING;

    @Column(name = "attendance_marked_by")
    private Long attendanceMarkedBy;

    @Column(name = "attendance_marked_at")
    private Instant attendanceMarkedAt;

    @Enumerated(EnumType.STRING)
    @Column(name = "coach_assessment", length = 30)
    private CoachAssessment coachAssessment;

    @Column(name = "individual_notes", columnDefinition = "TEXT")
    private String individualNotes;

    @Column(name = "feedback_rating")
    private Short feedbackRating;

    @Column(name = "feedback_comment", columnDefinition = "TEXT")
    private String feedbackComment;

    @Column(name = "feedback_submitted_at")
    private Instant feedbackSubmittedAt;

    @Column(name = "coachee_progress_notes", columnDefinition = "TEXT")
    private String coacheeProgressNotes;

    @Column(name = "coachee_progress_submitted_at")
    private Instant coacheeProgressSubmittedAt;

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

    public Long getSessionId() { return sessionId; }
    public void setSessionId(Long sessionId) { this.sessionId = sessionId; }

    public Long getEmployeeId() { return employeeId; }
    public void setEmployeeId(Long employeeId) { this.employeeId = employeeId; }

    public ParticipantRole getRole() { return role; }
    public void setRole(ParticipantRole role) { this.role = role; }

    public InvitationStatus getInvitationStatus() { return invitationStatus; }
    public void setInvitationStatus(InvitationStatus invitationStatus) { this.invitationStatus = invitationStatus; }

    public String getInvitationDeclineReason() { return invitationDeclineReason; }
    public void setInvitationDeclineReason(String invitationDeclineReason) { this.invitationDeclineReason = invitationDeclineReason; }

    public Instant getRespondedAt() { return respondedAt; }
    public void setRespondedAt(Instant respondedAt) { this.respondedAt = respondedAt; }

    public AttendanceStatus getAttendanceStatus() { return attendanceStatus; }
    public void setAttendanceStatus(AttendanceStatus attendanceStatus) { this.attendanceStatus = attendanceStatus; }

    public Long getAttendanceMarkedBy() { return attendanceMarkedBy; }
    public void setAttendanceMarkedBy(Long attendanceMarkedBy) { this.attendanceMarkedBy = attendanceMarkedBy; }

    public Instant getAttendanceMarkedAt() { return attendanceMarkedAt; }
    public void setAttendanceMarkedAt(Instant attendanceMarkedAt) { this.attendanceMarkedAt = attendanceMarkedAt; }

    public CoachAssessment getCoachAssessment() { return coachAssessment; }
    public void setCoachAssessment(CoachAssessment coachAssessment) { this.coachAssessment = coachAssessment; }

    public String getIndividualNotes() { return individualNotes; }
    public void setIndividualNotes(String individualNotes) { this.individualNotes = individualNotes; }

    public Short getFeedbackRating() { return feedbackRating; }
    public void setFeedbackRating(Short feedbackRating) { this.feedbackRating = feedbackRating; }

    public String getFeedbackComment() { return feedbackComment; }
    public void setFeedbackComment(String feedbackComment) { this.feedbackComment = feedbackComment; }

    public Instant getFeedbackSubmittedAt() { return feedbackSubmittedAt; }
    public void setFeedbackSubmittedAt(Instant feedbackSubmittedAt) { this.feedbackSubmittedAt = feedbackSubmittedAt; }

    public String getCoacheeProgressNotes() { return coacheeProgressNotes; }
    public void setCoacheeProgressNotes(String coacheeProgressNotes) { this.coacheeProgressNotes = coacheeProgressNotes; }

    public Instant getCoacheeProgressSubmittedAt() { return coacheeProgressSubmittedAt; }
    public void setCoacheeProgressSubmittedAt(Instant coacheeProgressSubmittedAt) { this.coacheeProgressSubmittedAt = coacheeProgressSubmittedAt; }

    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
}

