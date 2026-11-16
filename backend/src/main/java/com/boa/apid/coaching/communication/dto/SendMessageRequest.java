package com.boa.apid.coaching.communication.dto;

import com.boa.apid.coaching.communication.entity.MessageType;
import jakarta.validation.constraints.Size;

import java.util.List;

public class SendMessageRequest {

    private MessageType messageType = MessageType.TEXT;

    @Size(max = 10000, message = "Message content cannot exceed 10000 characters")
    private String content;

    @Size(max = 64, message = "Client message ID cannot exceed 64 characters")
    private String clientMessageId;

    private Long replyToMessageId;

    private List<Long> attachmentIds;

    public SendMessageRequest() {}

    public MessageType getMessageType() { return messageType; }
    public void setMessageType(MessageType messageType) { this.messageType = messageType; }
    public String getContent() { return content; }
    public void setContent(String content) { this.content = content; }
    public String getClientMessageId() { return clientMessageId; }
    public void setClientMessageId(String clientMessageId) { this.clientMessageId = clientMessageId; }
    public Long getReplyToMessageId() { return replyToMessageId; }
    public void setReplyToMessageId(Long replyToMessageId) { this.replyToMessageId = replyToMessageId; }
    public List<Long> getAttachmentIds() { return attachmentIds; }
    public void setAttachmentIds(List<Long> attachmentIds) { this.attachmentIds = attachmentIds; }
}

