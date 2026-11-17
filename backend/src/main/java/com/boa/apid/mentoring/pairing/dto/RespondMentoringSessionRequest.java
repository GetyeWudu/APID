package com.boa.apid.mentoring.pairing.dto;

public record RespondMentoringSessionRequest(
        boolean accept,
        String declineReason
) {
}

