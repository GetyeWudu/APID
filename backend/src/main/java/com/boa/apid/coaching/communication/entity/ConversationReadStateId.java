package com.boa.apid.coaching.communication.entity;

import java.io.Serializable;
import java.util.Objects;

public class ConversationReadStateId implements Serializable {

    private Long conversationId;
    private Long userId;

    public ConversationReadStateId() {}

    public ConversationReadStateId(Long conversationId, Long userId) {
        this.conversationId = conversationId;
        this.userId = userId;
    }

    public Long getConversationId() { return conversationId; }
    public void setConversationId(Long conversationId) { this.conversationId = conversationId; }
    public Long getUserId() { return userId; }
    public void setUserId(Long userId) { this.userId = userId; }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;
        ConversationReadStateId that = (ConversationReadStateId) o;
        return Objects.equals(conversationId, that.conversationId) && Objects.equals(userId, that.userId);
    }

    @Override
    public int hashCode() {
        return Objects.hash(conversationId, userId);
    }
}

