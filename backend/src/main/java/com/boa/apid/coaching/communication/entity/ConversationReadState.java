package com.boa.apid.coaching.communication.entity;

import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(name = "conversation_read_state", schema = "core")
@IdClass(ConversationReadStateId.class)
public class ConversationReadState {

    @Id
    @Column(name = "conversation_id", nullable = false)
    private Long conversationId;

    @Id
    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(name = "last_read_message_id")
    private Long lastReadMessageId;

    @Column(name = "last_read_at", nullable = false)
    private Instant lastReadAt;

    public ConversationReadState() {}

    public ConversationReadState(Long conversationId, Long userId, Long lastReadMessageId) {
        this.conversationId = conversationId;
        this.userId = userId;
        this.lastReadMessageId = lastReadMessageId;
        this.lastReadAt = Instant.now();
    }

    public Long getConversationId() { return conversationId; }
    public void setConversationId(Long conversationId) { this.conversationId = conversationId; }
    public Long getUserId() { return userId; }
    public void setUserId(Long userId) { this.userId = userId; }
    public Long getLastReadMessageId() { return lastReadMessageId; }
    public void setLastReadMessageId(Long lastReadMessageId) { this.lastReadMessageId = lastReadMessageId; }
    public Instant getLastReadAt() { return lastReadAt; }
    public void setLastReadAt(Instant lastReadAt) { this.lastReadAt = lastReadAt; }
}

