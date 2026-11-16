package com.boa.apid.mentoring.application.dto;

import com.boa.apid.mentoring.application.entity.MentorApplicationStatus;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record MentorApplicationReviewRequest(
        @NotNull MentorApplicationStatus decision,
        @Size(max = 750) String reason
) {
}
