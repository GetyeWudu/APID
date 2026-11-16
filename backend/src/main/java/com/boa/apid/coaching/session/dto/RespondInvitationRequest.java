package com.boa.apid.coaching.session.dto;

public record RespondInvitationRequest(
        boolean accept,
        String declineReason
) {}

