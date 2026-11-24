package com.boa.apid.coaching.ai.dto;

public record AiCopilotRequestDto(
        String query,
        Long quarterId
) {
}
