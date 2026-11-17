package com.boa.apid.coaching.assignment.dto;

import com.boa.apid.coaching.importpms.dto.PmsGoalLineDto;
import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.List;

public record CoachingAssignmentDetailDto(
        CoachingAssignmentDto assignment,
        List<PmsGoalLineDto> goalLines,
        List<CoachReplacementHistoryDto> replacementHistory,
        List<CoachingParticipantDto> participants
) {
    @JsonProperty("triggeringGoals")
    public List<PmsGoalLineDto> getTriggeringGoals() {
        return goalLines != null ? goalLines : List.of();
    }
}


