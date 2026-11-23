package com.boa.apid.coaching.session.dto;

import java.util.List;

public record PrefillMinutesRequest(
        String sessionNotesMinutes,
        String actionItems,
        List<String> keyTopics
) {}
