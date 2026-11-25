package com.boa.apid.mentoring.trainer.dto;

import java.util.List;

public record MentoringHrOverviewDto(
        long pendingApplications,
        long approvedApplications,
        long declinedApplications,
        long activeTrainers,
        long suspendedTrainers,
        long revokedTrainers,
        long activeRelationships,
        long completedRelationships,
        long totalSessions,
        long completedSessions,
        Double averageFeedbackRating,
        double completionRatePct,
        List<MentoringSkillDemandDto> skillSupplyDemand,
        MentoringRequestBacklogDto requestBacklog,
        MentoringFeedbackReportDto feedbackReport
) {
}
