package com.boa.apid.coaching.governance.dto;

import com.boa.apid.coaching.governance.entity.CadenceType;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;
import java.util.Map;

public record SeriesPreviewRequest(
        @NotNull LocalDate firstSessionDate,
        LocalDate quarterEndDate,
        @NotNull CadenceType cadenceType,
        @NotBlank String daysOfWeek, // "TUESDAY" or "TUESDAY,THURSDAY"
        @NotNull LocalTime preferredStartTime,
        @NotNull @Min(15) Integer durationMinutes,
        @NotNull @Min(1) Integer targetOccurrences,
        Long assignmentId,
        Long skillRequestId,
        List<Long> additionalAssignmentIds,
        Map<String, LocalTime> dayStartTimes,
        List<CustomSessionSlotDto> customSessions
) {
    public SeriesPreviewRequest(
            LocalDate firstSessionDate,
            LocalDate quarterEndDate,
            CadenceType cadenceType,
            String daysOfWeek,
            LocalTime preferredStartTime,
            Integer durationMinutes,
            Integer targetOccurrences
    ) {
        this(firstSessionDate, quarterEndDate, cadenceType, daysOfWeek, preferredStartTime, durationMinutes, targetOccurrences, null, null, null, null, null);
    }

    public SeriesPreviewRequest(
            LocalDate firstSessionDate,
            LocalDate quarterEndDate,
            CadenceType cadenceType,
            String daysOfWeek,
            LocalTime preferredStartTime,
            Integer durationMinutes,
            Integer targetOccurrences,
            Long assignmentId,
            Long skillRequestId,
            List<Long> additionalAssignmentIds
    ) {
        this(firstSessionDate, quarterEndDate, cadenceType, daysOfWeek, preferredStartTime, durationMinutes, targetOccurrences, assignmentId, skillRequestId, additionalAssignmentIds, null, null);
    }

    public SeriesPreviewRequest(
            LocalDate firstSessionDate,
            LocalDate quarterEndDate,
            CadenceType cadenceType,
            String daysOfWeek,
            LocalTime preferredStartTime,
            Integer durationMinutes,
            Integer targetOccurrences,
            Long assignmentId,
            Long skillRequestId,
            List<Long> additionalAssignmentIds,
            Map<String, LocalTime> dayStartTimes
    ) {
        this(firstSessionDate, quarterEndDate, cadenceType, daysOfWeek, preferredStartTime, durationMinutes, targetOccurrences, assignmentId, skillRequestId, additionalAssignmentIds, dayStartTimes, null);
    }
}
