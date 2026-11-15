package com.boa.apid.coaching.communication.dto;

import com.boa.apid.coaching.communication.entity.ConversationParticipantRole;
import com.boa.apid.coaching.communication.entity.MessageType;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

public class MessageDto {
    private Long id;
    private Long conversationId;
    private Long senderEmployeeId;
    private Long senderUserId;
    private String senderName;
    private ConversationParticipantRole senderRole;
    private MessageType messageType;
    private String content;
    private String clientMessageId;
    private Long replyToMessageId;
    private String replyToSnippet;
    private String replyToSenderName;
    private boolean isPinned;
    private String pinnedByName;
    private Instant pinnedAt;
    private boolean isDeleted;
    private Instant createdAt;
    private List<AttachmentDto> attachments = new ArrayList<>();

    public MessageDto() {}

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Long getConversationId() { return conversationId; }
    public void setConversationId(Long conversationId) { this.conversationId = conversationId; }
    public Long getSenderEmployeeId() { return senderEmployeeId; }
    public void setSenderEmployeeId(Long senderEmployeeId) { this.senderEmployeeId = senderEmployeeId; }
    public Long getSenderUserId() { return senderUserId; }
    public void setSenderUserId(Long senderUserId) { this.senderUserId = senderUserId; }
    public String getSenderName() { return senderName; }
    public void setSenderName(String senderName) { this.senderName = senderName; }
    public ConversationParticipantRole getSenderRole() { return senderRole; }
    public void setSenderRole(ConversationParticipantRole senderRole) { this.senderRole = senderRole; }
    public MessageType getMessageType() { return messageType; }
    public void setMessageType(MessageType messageType) { this.messageType = messageType; }
    public String getContent() { return content; }
    public void setContent(String content) { this.content = content; }
    public String getClientMessageId() { return clientMessageId; }
    public void setClientMessageId(String clientMessageId) { this.clientMessageId = clientMessageId; }
    public Long getReplyToMessageId() { return replyToMessageId; }
    public void setReplyToMessageId(Long replyToMessageId) { this.replyToMessageId = replyToMessageId; }
    public String getReplyToSnippet() { return replyToSnippet; }
    public void setReplyToSnippet(String replyToSnippet) { this.replyToSnippet = replyToSnippet; }
    public String getReplyToSenderName() { return replyToSenderName; }
    public void setReplyToSenderName(String replyToSenderName) { this.replyToSenderName = replyToSenderName; }
    public boolean isPinned() { return isPinned; }
    public void setPinned(boolean pinned) { isPinned = pinned; }
    public String getPinnedByName() { return pinnedByName; }
    public void setPinnedByName(String pinnedByName) { this.pinnedByName = pinnedByName; }
    public Instant getPinnedAt() { return pinnedAt; }
    public void setPinnedAt(Instant pinnedAt) { this.pinnedAt = pinnedAt; }
    public boolean isDeleted() { return isDeleted; }
    public void setDeleted(boolean deleted) { isDeleted = deleted; }
    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
    public List<AttachmentDto> getAttachments() { return attachments; }
    public void setAttachments(List<AttachmentDto> attachments) { this.attachments = attachments; }
}
