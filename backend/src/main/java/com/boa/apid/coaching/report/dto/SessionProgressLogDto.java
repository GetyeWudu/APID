package com.boa.apid.coaching.report.dto;

import com.boa.apid.coaching.session.entity.AttendanceStatus;
import com.boa.apid.coaching.session.entity.CoachAssessment;
import com.boa.apid.coaching.session.entity.SessionMeetingMode;
import com.boa.apid.coaching.session.entity.SessionStatus;

import java.time.Instant;

public record SessionProgressLogDto(
        Long sessionId,
        Integer sequenceNumber,
        String sessionTitle,
        Instant scheduledStartTime,
        Instant conductedAt,
        int durationMinutes,
        SessionMeetingMode meetingMode,
        SessionStatus sessionStatus,

        // Coach's Evaluation & Commitments
        Long coachEmployeeId,
        String coachName,
        CoachAssessment coachAssessment,
        String sessionDiscussionMinutes,
        String actionItemsAssigned,

        // Coachee's Two-Way Submission & Practice Log
        Long coacheeEmployeeId,
        String coacheeName,
        AttendanceStatus coacheeAttendanceStatus,
        String coacheeProgressNotes,
        Instant coacheeProgressSubmittedAt,
        Short feedbackRating,
        String feedbackComment,
        Instant feedbackSubmittedAt
) {}

