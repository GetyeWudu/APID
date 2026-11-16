package com.boa.apid.coaching.session.dto;

public record RespondRescheduleProposalRequest(
        boolean accept,
        String responseNotes
) {}
