package com.boa.apid.coaching.communication.dto;

import com.boa.apid.coaching.communication.entity.ConversationParticipantRole;
import com.boa.apid.coaching.communication.entity.ParticipantStatus;

import java.time.Instant;

public class ParticipantDto {
    private Long id;
    private Long employeeId;
    private Long userId;
    private String employeeNumber;
    private String fullName;
    private String email;
    private String jobTitle;
    private ConversationParticipantRole role;
    private ParticipantStatus status;
    private Instant joinedAt;
    private Instant leftAt;

    public ParticipantDto() {}

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Long getEmployeeId() { return employeeId; }
    public void setEmployeeId(Long employeeId) { this.employeeId = employeeId; }
    public Long getUserId() { return userId; }
    public void setUserId(Long userId) { this.userId = userId; }
    public String getEmployeeNumber() { return employeeNumber; }
    public void setEmployeeNumber(String employeeNumber) { this.employeeNumber = employeeNumber; }
    public String getFullName() { return fullName; }
    public void setFullName(String fullName) { this.fullName = fullName; }
    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }
    public String getJobTitle() { return jobTitle; }
    public void setJobTitle(String jobTitle) { this.jobTitle = jobTitle; }
    public ConversationParticipantRole getRole() { return role; }
    public void setRole(ConversationParticipantRole role) { this.role = role; }
    public ParticipantStatus getStatus() { return status; }
    public void setStatus(ParticipantStatus status) { this.status = status; }
    public Instant getJoinedAt() { return joinedAt; }
    public void setJoinedAt(Instant joinedAt) { this.joinedAt = joinedAt; }
    public Instant getLeftAt() { return leftAt; }
    public void setLeftAt(Instant leftAt) { this.leftAt = leftAt; }
}
