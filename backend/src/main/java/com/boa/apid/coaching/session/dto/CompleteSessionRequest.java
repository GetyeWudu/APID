package com.boa.apid.coaching.session.dto;

import com.boa.apid.coaching.session.entity.AttendanceStatus;
import com.boa.apid.coaching.session.entity.CoachAssessment;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.util.List;

public record CompleteSessionRequest(
        @NotBlank String sessionNotesMinutes,
        String actionItems,
        @NotNull List<ParticipantAttendanceInput> participantAttendances
) {
    public record ParticipantAttendanceInput(
            @NotNull Long employeeId,
            @NotNull AttendanceStatus attendanceStatus,
            CoachAssessment coachAssessment,
            String individualNotes
    ) {}
}

