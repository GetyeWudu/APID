package com.boa.apid.mentoring.application.service;

import com.boa.apid.mentoring.application.dto.MentorAgreementTermsDto;

import java.util.List;

public final class MentorAgreementPolicy {

    public static final String VERSION = "mentor-terms-v1";
    public static final List<String> CONDITIONS = List.of(
            "Remain an active mentor for at least 30 days from approval before requesting voluntary removal. HR may review exceptions for health, safety, or other exceptional circumstances.",
            "Commit to completing mentoring engagements with at least seven trainees, subject to trainee availability and HR-approved assignments.",
            "Attend scheduled mentoring sessions reliably and give reasonable notice when a session must be changed.",
            "Keep availability and mentoring profile information accurate, and notify HR if you can no longer meet your mentoring commitment.",
            "Treat trainees respectfully and fairly, maintain appropriate professional boundaries, and follow organizational safeguarding policies.",
            "Protect trainee privacy and use personal information only for mentoring, except where disclosure is required for safety or by law.",
            "Keep mentoring progress and completion reports accurate, timely, and disclose any actual or potential conflicts of interest."
    );

    private MentorAgreementPolicy() {
    }

    public static MentorAgreementTermsDto terms() {
        return new MentorAgreementTermsDto(VERSION, CONDITIONS);
    }

    public static String snapshot() {
        return String.join("\n", CONDITIONS);
    }
}
