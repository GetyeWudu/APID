package com.boa.apid.mentoring.trainer.dto;

import com.boa.apid.mentoring.trainer.service.TrainerInFlightPolicy;
import com.boa.apid.mentoring.trainer.entity.TrainerAuthorizationStatus;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record TrainerStatusRequest(
        @NotNull TrainerAuthorizationStatus status,
        TrainerInFlightPolicy inFlightPolicy,
        @NotNull @Size(min = 5, max = 1000) String reason
) {
}
