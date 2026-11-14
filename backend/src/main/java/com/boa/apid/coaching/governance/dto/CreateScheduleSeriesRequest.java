package com.boa.apid.coaching.governance.dto;

import com.boa.apid.coaching.governance.entity.CadenceType;
import com.boa.apid.coaching.session.entity.SessionMeetingMode;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.time.LocalDate;
import java.time.LocalTime;

public record CreateScheduleSeriesRequest(
        Long assignmentId,
        Long skillRequestId,
        @NotBlank String title,
        @NotNull CadenceType cadenceType,
        @NotBlank String daysOfWeek,
        @NotNull LocalTime preferredStartTime,
        @NotNull @Min(15) Integer durationMinutes,
        SessionMeetingMode meetingMode,
        String meetingLocation,
        @NotNull LocalDate firstSessionDate,
        LocalDate quarterEndDate,
        @NotNull @Min(1) Integer targetOccurrences,
        Long targetPmsGoalId
) {}

