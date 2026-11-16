package com.boa.apid.coaching.governance.dto;

import java.util.List;

public record SeriesPreviewResponse(
        int targetOccurrences,
        int generatedOccurrences,
        int shortfall,
        boolean hasShortfall,
        String shortfallMessage,
        List<GeneratedDatePreviewDto> previewDates
) {}

