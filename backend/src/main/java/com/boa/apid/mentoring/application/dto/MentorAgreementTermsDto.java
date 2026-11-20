package com.boa.apid.mentoring.application.dto;

import java.util.List;

public record MentorAgreementTermsDto(
        String version,
        List<String> conditions
) {
}
