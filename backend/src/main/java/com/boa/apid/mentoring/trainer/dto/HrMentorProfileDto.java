package com.boa.apid.mentoring.trainer.dto;

import java.util.List;

public record HrMentorProfileDto(
        boolean acceptingNewPairings,
        boolean profileSetupRequired,
        TrainerRosterDto profile,
        List<TrainerSkillDto> activeSkills
) {
}
