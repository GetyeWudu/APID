package com.boa.apid.mentoring.pairing.dto;

import java.util.List;

public record MentoringChatHistoryDto(
        List<MentoringChatMessageDto> messages,
        int page,
        int pageSize,
        boolean hasMore
) {
}
