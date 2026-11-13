package com.boa.apid.coaching.session.dto;

import com.boa.apid.coaching.session.entity.SessionMeetingMode;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.time.Instant;

public record CreateSessionRequest(
        Long assignmentId,
        Long skillRequestId,
        @NotBlank String title,
        @NotNull Instant scheduledStartTime,
        @Min(15) @Max(180) int durationMinutes,
        @NotNull SessionMeetingMode meetingMode,
        String meetingLocation,
        Long targetPmsGoalId
) {}

