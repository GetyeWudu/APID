package com.boa.apid.coaching.report.dto;

import java.time.Instant;
import java.util.List;

public record SessionInspectionEvidenceDto(
        Long sessionId,
        Long assignmentId,
        String sessionTitle,
        String meetingMode,
        String sessionStatus,
        Instant conductedAt,
        Integer durationMinutes,

        // Coach & Coachee Metadata
        Long coachEmployeeId,
        String coachName,
        String coachRole,
        Long coacheeEmployeeId,
        String coacheeName,
        String coacheeStaffId,
        String districtName,
        String branchName,

        // Attendance & Evaluations
        String attendanceStatus,
        String coachAssessment,
        String coacheeProgressNotes,
        Short coacheeFeedbackRating,
        String coacheeFeedbackComment,

        // AI Synthesis & Evidence
        String minutesSynthesisStatus,
        String aiSessionNotesMinutes,
        String aiActionItems,
        List<String> aiKeyTopics,

        // Speech Turns (Bilingual English / Amharic)
        List<SessionTurnEvidenceDto> speechTurns
) {}
