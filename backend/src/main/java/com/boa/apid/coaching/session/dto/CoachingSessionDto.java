package com.boa.apid.coaching.session.dto;

import com.boa.apid.coaching.assignment.entity.AssignmentPathway;
import com.boa.apid.coaching.session.entity.SessionMeetingMode;
import com.boa.apid.coaching.session.entity.SessionStatus;
import java.time.Instant;
import java.util.List;

public record CoachingSessionDto(
        Long id,
        Long assignmentId,
        Long skillRequestId,
        Long coachEmployeeId,
        String coachEmployeeNumber,
        String coachFullName,
        String coachJobTitle,
        String coachDepartment,
        String title,
        AssignmentPathway pathway,
        Instant scheduledStartTime,
        Instant scheduledEndTime,
        int durationMinutes,
        SessionMeetingMode meetingMode,
        String meetingLocation,
        String dailyRoomName,
        String dailyRoomUrl,
        SessionStatus status,
        String cancellationReason,
        Long targetPmsGoalId,
        String targetPmsGoalName,
        String sessionNotesMinutes,
        String actionItems,
        Instant conductedAt,
        List<SessionParticipantDto> participants,
        Instant createdAt
) {}

