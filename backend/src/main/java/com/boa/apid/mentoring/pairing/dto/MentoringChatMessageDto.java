package com.boa.apid.mentoring.pairing.dto;

import java.time.Instant;

public record MentoringChatMessageDto(
        Long id,
        Long relationshipId,
        Long senderUserId,
        String senderName,
        String body,
        Instant createdAt,
        boolean mine
) {
}
