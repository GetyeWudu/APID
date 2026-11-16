package com.boa.apid.coaching.communication.dto;

import com.boa.apid.coaching.communication.entity.ConversationContextType;
import com.boa.apid.coaching.communication.entity.ConversationStatus;
import com.boa.apid.coaching.communication.entity.ConversationType;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

public class ConversationSummaryDto {
    private Long id;
    private ConversationType conversationType;
    private ConversationContextType contextType;
    private Long assignmentId;
    private Long skillRequestId;
    private Long peerEmployeeAId;
    private Long peerEmployeeBId;
    private String title;
    private ConversationStatus status;
    private long unreadCount;
    private String lastMessageSnippet;
    private Instant lastMessageAt;
    private String lastMessageSenderName;
    private Instant updatedAt;
    private List<ParticipantDto> participants = new ArrayList<>();
    private List<MessageDto> pinnedMessages = new ArrayList<>();

    public ConversationSummaryDto() {}

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public ConversationType getConversationType() { return conversationType; }
    public void setConversationType(ConversationType conversationType) { this.conversationType = conversationType; }
    public ConversationContextType getContextType() { return contextType; }
    public void setContextType(ConversationContextType contextType) { this.contextType = contextType; }
    public Long getAssignmentId() { return assignmentId; }
    public void setAssignmentId(Long assignmentId) { this.assignmentId = assignmentId; }
    public Long getSkillRequestId() { return skillRequestId; }
    public void setSkillRequestId(Long skillRequestId) { this.skillRequestId = skillRequestId; }
    public Long getPeerEmployeeAId() { return peerEmployeeAId; }
    public void setPeerEmployeeAId(Long peerEmployeeAId) { this.peerEmployeeAId = peerEmployeeAId; }
    public Long getPeerEmployeeBId() { return peerEmployeeBId; }
    public void setPeerEmployeeBId(Long peerEmployeeBId) { this.peerEmployeeBId = peerEmployeeBId; }
    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }
    public ConversationStatus getStatus() { return status; }
    public void setStatus(ConversationStatus status) { this.status = status; }
    public long getUnreadCount() { return unreadCount; }
    public void setUnreadCount(long unreadCount) { this.unreadCount = unreadCount; }
    public String getLastMessageSnippet() { return lastMessageSnippet; }
    public void setLastMessageSnippet(String lastMessageSnippet) { this.lastMessageSnippet = lastMessageSnippet; }
    public Instant getLastMessageAt() { return lastMessageAt; }
    public void setLastMessageAt(Instant lastMessageAt) { this.lastMessageAt = lastMessageAt; }
    public String getLastMessageSenderName() { return lastMessageSenderName; }
    public void setLastMessageSenderName(String lastMessageSenderName) { this.lastMessageSenderName = lastMessageSenderName; }
    public Instant getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Instant updatedAt) { this.updatedAt = updatedAt; }
    public List<ParticipantDto> getParticipants() { return participants; }
    public void setParticipants(List<ParticipantDto> participants) { this.participants = participants; }
    public List<MessageDto> getPinnedMessages() { return pinnedMessages; }
    public void setPinnedMessages(List<MessageDto> pinnedMessages) { this.pinnedMessages = pinnedMessages; }
}

