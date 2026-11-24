package com.boa.apid.coaching.ai.dto;

import java.util.List;

public record AiCopilotResponseDto(
        String query,
        String answer,
        List<AiCopilotActionLinkDto> actionLinks,
        String model,
        long durationMs
) {
}
