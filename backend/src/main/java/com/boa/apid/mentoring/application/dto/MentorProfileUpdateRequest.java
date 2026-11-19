package com.boa.apid.mentoring.application.dto;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.util.List;

public record MentorProfileUpdateRequest(
        @NotBlank @Size(max = 100000) String profileDetails,
        @Size(max = 1000) String changeNote,
        @Size(max = 1000) String availabilityNotes,
        @Min(0) Integer experienceYears,
        @Size(max = 2000) String mentoringApproach,
        @Min(0) Integer sessionsPerWeek,
        List<Long> catalogSkillIds,
        @Size(max = 1000) String customSkill,
        List<@Size(max = 160) String> supportingEvidenceContexts
) {
}
