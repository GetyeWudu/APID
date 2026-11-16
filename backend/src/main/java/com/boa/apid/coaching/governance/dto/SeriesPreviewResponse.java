package com.boa.apid.coaching.governance.dto;

import java.util.List;

public record SeriesPreviewResponse(
        int targetOccurrences,
        int generatedOccurrences,
        int shortfall,
        boolean hasShortfall,
        String shortfallMessage,
        boolean hasConflict,
        String conflictSummary,
        List<GeneratedDatePreviewDto> previewDates
) {
    public SeriesPreviewResponse(
            int targetOccurrences,
            int generatedOccurrences,
            int shortfall,
            boolean hasShortfall,
            String shortfallMessage,
            List<GeneratedDatePreviewDto> previewDates
    ) {
        this(targetOccurrences, generatedOccurrences, shortfall, hasShortfall, shortfallMessage, false, null, previewDates);
    }
}
