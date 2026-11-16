package com.boa.apid.mentoring.trainer.dto;

import com.boa.apid.mentoring.trainer.entity.TrainerAuthorizationStatus;

public record TrainerSkillDto(
        Long id,
        String name,
        String category,
        TrainerAuthorizationStatus status,
        String statusReason
) {
}
