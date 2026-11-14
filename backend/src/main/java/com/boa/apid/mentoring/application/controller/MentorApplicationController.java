package com.boa.apid.mentoring.application.controller;

import com.boa.apid.common.response.ApiResponse;
import com.boa.apid.core.auth.security.ApidUserPrincipal;
import com.boa.apid.mentoring.application.dto.MentorApplicationDto;
import com.boa.apid.mentoring.application.dto.MentorApplicationSubmittedDto;
import com.boa.apid.mentoring.application.service.MentorApplicationService;
import org.springframework.http.MediaType;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

@RestController
@RequestMapping("/api/v1/mentoring/applications")
public class MentorApplicationController {

    private final MentorApplicationService mentorApplicationService;

    public MentorApplicationController(MentorApplicationService mentorApplicationService) {
        this.mentorApplicationService = mentorApplicationService;
    }

    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize("hasAuthority('EMPLOYEE_PORTAL_ACCESS')")
    public ApiResponse<MentorApplicationSubmittedDto> submit(
            @RequestParam(value = "catalogSkillId", required = false) Long catalogSkillId,
            @RequestParam(value = "customSkill", required = false) String customSkill,
            @RequestParam(value = "note", required = false) String note,
            @RequestParam("proofDocument") MultipartFile proofDocument,
            @AuthenticationPrincipal ApidUserPrincipal actor
    ) {
        return ApiResponse.ok(
                "Mentor application submitted",
                mentorApplicationService.submit(catalogSkillId, customSkill, note, proofDocument, actor)
        );
    }

    @GetMapping
    @PreAuthorize("hasAuthority('TRAINER_APPLICATION_REVIEW')")
    public ApiResponse<List<MentorApplicationDto>> listApplications() {
        return ApiResponse.ok(mentorApplicationService.listApplications());
    }
}
