package com.boa.apid.mentoring.application.dto;

import com.boa.apid.mentoring.application.entity.MentorApplicationStatus;

import java.time.Instant;
import java.util.List;

public record MentorApplicationSubmittedDto(
        Long id,
        MentorApplicationStatus status,
        Long catalogSkillId,
        List<Long> catalogSkillIds,
        String customSkill,
        Instant submittedAt
) {}
