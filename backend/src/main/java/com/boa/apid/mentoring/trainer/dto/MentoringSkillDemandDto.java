package com.boa.apid.mentoring.trainer.dto;

public record MentoringSkillDemandDto(
        Long skillId,
        String skillName,
        long activeTrainers,
        long openRequests,
        long availableTrainerSlots
) {
}
