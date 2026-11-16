package com.boa.apid.coaching.communication.entity;

import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(name = "messages", schema = "core")
public class CoachingMessage {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "conversation_id", nullable = false)
    private Long conversationId;

    @Column(name = "sender_employee_id", nullable = false)
    private Long senderEmployeeId;

    @Column(name = "sender_user_id", nullable = false)
    private Long senderUserId;

    @Enumerated(EnumType.STRING)
    @Column(name = "message_type", nullable = false, length = 20)
    private MessageType messageType = MessageType.TEXT;

    @Column(name = "content", columnDefinition = "TEXT")
    private String content;

    @Column(name = "client_message_id", length = 64)
    private String clientMessageId;

    @Column(name = "reply_to_message_id")
    private Long replyToMessageId;

    @Column(name = "is_pinned", nullable = false)
    private boolean isPinned = false;

    @Column(name = "pinned_by_user_id")
    private Long pinnedByUserId;

    @Column(name = "pinned_at")
    private Instant pinnedAt;

    @Column(name = "is_deleted", nullable = false)
    private boolean isDeleted = false;

    @Column(name = "deleted_at")
    private Instant deletedAt;

    @Column(name = "deleted_by_user_id")
    private Long deletedByUserId;

    @Column(name = "edited_at")
    private Instant editedAt;

    @Column(name = "edited_by_user_id")
    private Long editedByUserId;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @PrePersist
    void onCreate() {
        if (this.createdAt == null) {
            this.createdAt = Instant.now();
        }
    }

    // ---- Getters and Setters ----

    public Long getId() { return id; }
    public Long getConversationId() { return conversationId; }
    public void setConversationId(Long conversationId) { this.conversationId = conversationId; }
    public Long getSenderEmployeeId() { return senderEmployeeId; }
    public void setSenderEmployeeId(Long senderEmployeeId) { this.senderEmployeeId = senderEmployeeId; }
    public Long getSenderUserId() { return senderUserId; }
    public void setSenderUserId(Long senderUserId) { this.senderUserId = senderUserId; }
    public MessageType getMessageType() { return messageType; }
    public void setMessageType(MessageType messageType) { this.messageType = messageType; }
    public String getContent() { return content; }
    public void setContent(String content) { this.content = content; }
    public String getClientMessageId() { return clientMessageId; }
    public void setClientMessageId(String clientMessageId) { this.clientMessageId = clientMessageId; }
    public Long getReplyToMessageId() { return replyToMessageId; }
    public void setReplyToMessageId(Long replyToMessageId) { this.replyToMessageId = replyToMessageId; }
    public boolean isPinned() { return isPinned; }
    public void setPinned(boolean pinned) { isPinned = pinned; }
    public Long getPinnedByUserId() { return pinnedByUserId; }
    public void setPinnedByUserId(Long pinnedByUserId) { this.pinnedByUserId = pinnedByUserId; }
    public Instant getPinnedAt() { return pinnedAt; }
    public void setPinnedAt(Instant pinnedAt) { this.pinnedAt = pinnedAt; }
    public boolean isDeleted() { return isDeleted; }
    public void setDeleted(boolean deleted) { isDeleted = deleted; }
    public Instant getDeletedAt() { return deletedAt; }
    public void setDeletedAt(Instant deletedAt) { this.deletedAt = deletedAt; }
    public Long getDeletedByUserId() { return deletedByUserId; }
    public void setDeletedByUserId(Long deletedByUserId) { this.deletedByUserId = deletedByUserId; }
    public Instant getEditedAt() { return editedAt; }
    public void setEditedAt(Instant editedAt) { this.editedAt = editedAt; }
    public Long getEditedByUserId() { return editedByUserId; }
    public void setEditedByUserId(Long editedByUserId) { this.editedByUserId = editedByUserId; }
    public Instant getCreatedAt() { return createdAt; }
}

