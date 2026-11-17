package com.boa.apid.mentoring.pairing.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record MentoringSessionReportRequest(
        @NotBlank @Size(max = 4000) String reportNote
) {
}
