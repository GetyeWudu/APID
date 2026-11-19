package com.boa.apid.mentoring.application.controller;

import com.boa.apid.common.response.ApiResponse;
import com.boa.apid.mentoring.application.dto.MentorApplicationDocumentSummaryDto;
import com.boa.apid.mentoring.ai.document.service.MentorApplicationDocumentSummaryService;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/mentoring/applications")
public class MentorApplicationDocumentSummaryController {

    private final MentorApplicationDocumentSummaryService summaryService;

    public MentorApplicationDocumentSummaryController(
            MentorApplicationDocumentSummaryService summaryService
    ) {
        this.summaryService = summaryService;
    }

    @PostMapping("/{applicationId}/evidence/{fileId}/summary")
    @PreAuthorize("hasAuthority('TRAINER_APPLICATION_REVIEW')")
    public ApiResponse<MentorApplicationDocumentSummaryDto> summarize(
            @PathVariable Long applicationId,
            @PathVariable Long fileId
    ) {
        return ApiResponse.ok(summaryService.summarize(applicationId, fileId));
    }
}
