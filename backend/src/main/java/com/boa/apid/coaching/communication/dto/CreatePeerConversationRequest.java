package com.boa.apid.coaching.communication.dto;

import jakarta.validation.constraints.NotNull;

public class CreatePeerConversationRequest {

    @NotNull(message = "skillRequestId is required")
    private Long skillRequestId;

    @NotNull(message = "targetEmployeeId is required")
    private Long targetEmployeeId;

    public CreatePeerConversationRequest() {}

    public Long getSkillRequestId() { return skillRequestId; }
    public void setSkillRequestId(Long skillRequestId) { this.skillRequestId = skillRequestId; }
    public Long getTargetEmployeeId() { return targetEmployeeId; }
    public void setTargetEmployeeId(Long targetEmployeeId) { this.targetEmployeeId = targetEmployeeId; }
}
