package com.boa.apid.coaching.session.dto;

import com.boa.apid.coaching.session.entity.SessionMeetingMode;
import jakarta.validation.constraints.Size;

import java.time.Instant;

public record UpdateSessionRequest(
        @Size(max = 255) String title,
        Instant scheduledStartTime,
        Integer durationMinutes,
        SessionMeetingMode meetingMode,
        @Size(max = 255) String meetingLocation,
        Long targetPmsGoalId,
        String reason,
        String prepNotes,
        String referenceMaterials,
        Boolean aiSummarizationEnabled,
        Boolean aiAgentEnabled
) {}
