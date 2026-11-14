package com.boa.apid.coaching.session.dto;

import com.boa.apid.coaching.session.entity.AttendanceStatus;
import com.boa.apid.coaching.session.entity.CoachAssessment;
import com.boa.apid.coaching.session.entity.InvitationStatus;
import com.boa.apid.coaching.session.entity.ParticipantRole;
import java.time.Instant;

public record SessionParticipantDto(
        Long id,
        Long sessionId,
        Long employeeId,
        String employeeNumber,
        String fullName,
        String departmentName,
        String position,
        ParticipantRole role,
        InvitationStatus invitationStatus,
        String invitationDeclineReason,
        Instant respondedAt,
        AttendanceStatus attendanceStatus,
        Instant attendanceMarkedAt,
        CoachAssessment coachAssessment,
        String individualNotes,
        Short feedbackRating,
        String feedbackComment,
        Instant feedbackSubmittedAt,
        String coacheeProgressNotes,
        Instant coacheeProgressSubmittedAt
) {}

