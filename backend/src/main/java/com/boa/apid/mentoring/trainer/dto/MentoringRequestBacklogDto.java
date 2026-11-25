package com.boa.apid.mentoring.trainer.dto;

public record MentoringRequestBacklogDto(
        long openRequests,
        double averageWaitDays,
        double oldestWaitDays,
        long waitingUnderTwoDays,
        long waitingTwoToSevenDays,
        long waitingSevenOrMoreDays
) {
}
