package com.boa.apid.mentoring.pairing.dto;

/**
 * Display name for a trainee targeted by a group session.
 * One-to-one sessions leave this list null.
 */
public record MentoringSessionParticipantDto(
        Long userId,
        String name
) {}
