package com.boa.apid.coaching.communication.dto;

import jakarta.validation.constraints.NotNull;

public class MarkReadRequest {

    @NotNull(message = "lastReadMessageId is required")
    private Long lastReadMessageId;

    public MarkReadRequest() {}

    public MarkReadRequest(Long lastReadMessageId) {
        this.lastReadMessageId = lastReadMessageId;
    }

    public Long getLastReadMessageId() { return lastReadMessageId; }
    public void setLastReadMessageId(Long lastReadMessageId) { this.lastReadMessageId = lastReadMessageId; }
}

