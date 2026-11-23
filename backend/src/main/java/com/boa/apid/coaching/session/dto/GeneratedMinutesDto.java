package com.boa.apid.coaching.session.dto;

import java.util.List;
import java.util.Map;

public record GeneratedMinutesDto(
        String sessionNotesMinutes,
        String actionItems,
        List<String> keyTopics,
        Map<String, String> rawCandidates
) {}
