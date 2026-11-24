package com.boa.apid.coaching.ai.dto;

import java.util.List;

public record AiExecutiveBriefingDto(
        Long fiscalQuarterId,
        String fiscalQuarterName,
        String generatedAt,
        String statusHeadline,
        int overallHealthScore,
        String executiveSummary,
        List<String> vulnerabilities,
        List<String> recommendedInterventions,
        boolean isCached
) {
}
