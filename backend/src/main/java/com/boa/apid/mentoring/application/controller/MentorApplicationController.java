package com.boa.apid.mentoring.application.controller;

import com.boa.apid.common.response.ApiResponse;
import com.boa.apid.core.auth.security.ApidUserPrincipal;
import com.boa.apid.mentoring.application.dto.MentorApplicationDto;
import com.boa.apid.mentoring.application.dto.MentorApplicationReviewRequest;
import com.boa.apid.mentoring.application.dto.MentorApplicationSubmittedDto;
import com.boa.apid.mentoring.application.service.MentorApplicationService;
import jakarta.validation.Valid;
import org.springframework.http.MediaType;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.util.ArrayList;
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
            @RequestParam(value = "catalogSkillIds", required = false) List<Long> catalogSkillIds,
            @RequestParam(value = "customSkill", required = false) String customSkill,
            @RequestParam(value = "note", required = false) String note,
            @RequestParam(value = "expertiseSummary", required = false) String expertiseSummary,
            @RequestParam(value = "availabilityNotes", required = false) String availabilityNotes,
            @RequestParam(value = "experienceYears", required = false) Integer experienceYears,
            @RequestParam(value = "mentoringApproach", required = false) String mentoringApproach,
            @RequestParam(value = "sessionsPerWeek", required = false) Integer sessionsPerWeek,
            @RequestParam(value = "maxConcurrentTrainees", required = false) Integer maxConcurrentTrainees,
            @RequestParam(value = "proofDocument", required = false) MultipartFile proofDocument,
            @RequestParam(value = "supportingEvidence", required = false) List<MultipartFile> supportingEvidence,
            @AuthenticationPrincipal ApidUserPrincipal actor
    ) {
        List<Long> selectedSkillIds = new ArrayList<>();
        if (catalogSkillId != null) {
            selectedSkillIds.add(catalogSkillId);
        }
        if (catalogSkillIds != null) {
            selectedSkillIds.addAll(catalogSkillIds);
        }
        List<MultipartFile> evidenceFiles = new ArrayList<>();
        if (supportingEvidence != null) {
            evidenceFiles.addAll(supportingEvidence);
        }
        if (proofDocument != null) {
            evidenceFiles.add(proofDocument);
        }
        return ApiResponse.ok(
                "Mentor application submitted",
                mentorApplicationService.submit(
                        selectedSkillIds,
                        customSkill,
                        note,
                        expertiseSummary,
                        availabilityNotes,
                        experienceYears,
                        mentoringApproach,
                        sessionsPerWeek,
                        maxConcurrentTrainees,
                        evidenceFiles,
                        actor
                )
        );
    }

    @PostMapping(value = "/skill-additions", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize("hasAuthority('EMPLOYEE_PORTAL_ACCESS')")
    public ApiResponse<MentorApplicationSubmittedDto> requestSkillAddition(
            @RequestParam(value = "catalogSkillId", required = false) Long catalogSkillId,
            @RequestParam(value = "catalogSkillIds", required = false) List<Long> catalogSkillIds,
            @RequestParam(value = "customSkill", required = false) String customSkill,
            @RequestParam(value = "note", required = false) String note,
            @RequestParam(value = "proofDocument", required = false) MultipartFile proofDocument,
            @RequestParam(value = "supportingEvidence", required = false) List<MultipartFile> supportingEvidence,
            @AuthenticationPrincipal ApidUserPrincipal actor
    ) {
        List<Long> selectedSkillIds = new ArrayList<>();
        if (catalogSkillId != null) {
            selectedSkillIds.add(catalogSkillId);
        }
        if (catalogSkillIds != null) {
            selectedSkillIds.addAll(catalogSkillIds);
        }
        List<MultipartFile> evidenceFiles = new ArrayList<>();
        if (supportingEvidence != null) {
            evidenceFiles.addAll(supportingEvidence);
        }
        if (proofDocument != null) {
            evidenceFiles.add(proofDocument);
        }
        return ApiResponse.ok(
                "Mentor skill addition submitted for review",
                mentorApplicationService.submitSkillAddition(
                        selectedSkillIds,
                        customSkill,
                        note,
                        evidenceFiles,
                        actor
                )
        );
    }

    @GetMapping("/mine")
    @PreAuthorize("hasAuthority('EMPLOYEE_PORTAL_ACCESS')")
    public ApiResponse<List<MentorApplicationDto>> listMyApplications(
            @AuthenticationPrincipal ApidUserPrincipal actor
    ) {
        return ApiResponse.ok(mentorApplicationService.listMyApplications(actor));
    }

    @GetMapping
    @PreAuthorize("hasAuthority('TRAINER_APPLICATION_REVIEW')")
    public ApiResponse<List<MentorApplicationDto>> listApplications() {
        return ApiResponse.ok(mentorApplicationService.listApplications());
    }

    @PatchMapping("/{applicationId}/review")
    @PreAuthorize("hasAuthority('TRAINER_APPLICATION_REVIEW')")
    public ApiResponse<MentorApplicationDto> reviewApplication(
            @PathVariable Long applicationId,
            @Valid @RequestBody MentorApplicationReviewRequest request,
            @AuthenticationPrincipal ApidUserPrincipal actor
    ) {
        return ApiResponse.ok(
                "Mentor application reviewed",
                mentorApplicationService.reviewApplication(applicationId, request, actor)
        );
    }
}
