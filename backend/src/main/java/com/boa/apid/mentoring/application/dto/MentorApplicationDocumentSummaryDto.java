package com.boa.apid.mentoring.application.dto;

public record MentorApplicationDocumentSummaryDto(
        Long applicationId,
        Long fileId,
        String fileName,
        String summary,
        boolean sourceTruncated
) {
}
