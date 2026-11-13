package com.boa.apid.coaching.assignment.dto;

import com.boa.apid.coaching.importpms.dto.PmsGoalLineDto;

import java.util.List;

public record CoachingAssignmentDetailDto(
        CoachingAssignmentDto assignment,
        List<PmsGoalLineDto> goalLines,
        List<CoachReplacementHistoryDto> replacementHistory,
        List<CoachingParticipantDto> participants
) {}

