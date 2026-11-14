package com.boa.apid.mentoring.application.dto;

import com.boa.apid.mentoring.application.entity.MentorApplicationStatus;

import java.time.Instant;

public record MentorApplicationSubmittedDto(
        Long id,
        MentorApplicationStatus status,
        Long catalogSkillId,
        String customSkill,
        Instant submittedAt
) {}
