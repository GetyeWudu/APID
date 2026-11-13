package com.boa.apid.coaching.skillrequest.dto;

public record ApproveSkillCoachingRequestPayload(
        Long overrideCoachEmployeeId,
        String reviewNotes
) {}

