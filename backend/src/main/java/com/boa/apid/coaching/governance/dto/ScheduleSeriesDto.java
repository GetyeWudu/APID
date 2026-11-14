package com.boa.apid.coaching.governance.dto;

import com.boa.apid.coaching.governance.entity.CadenceType;
import com.boa.apid.coaching.governance.entity.SeriesStatus;
import com.boa.apid.coaching.session.dto.CoachingSessionDto;
import com.boa.apid.coaching.session.entity.SessionMeetingMode;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;

public record ScheduleSeriesDto(
        Long id,
        Long assignmentId,
        Long skillRequestId,
        Long coachEmployeeId,
        String coachFullName,
        String title,
        CadenceType cadenceType,
        String daysOfWeek,
        LocalTime preferredStartTime,
        int durationMinutes,
        SessionMeetingMode meetingMode,
        String meetingLocation,
        LocalDate firstSessionDate,
        int targetOccurrences,
        int generatedOccurrences,
        SeriesStatus status,
        List<CoachingSessionDto> generatedSessions,
        Instant createdAt
) {}

