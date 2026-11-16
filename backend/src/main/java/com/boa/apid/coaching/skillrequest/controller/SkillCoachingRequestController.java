package com.boa.apid.coaching.skillrequest.controller;

import com.boa.apid.coaching.skillrequest.dto.*;
import com.boa.apid.coaching.skillrequest.service.SkillCoachingRequestService;
import com.boa.apid.common.response.ApiResponse;
import com.boa.apid.core.auth.security.ApidUserPrincipal;
import jakarta.validation.Valid;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/coaching/skill-requests")
public class SkillCoachingRequestController {

    private final SkillCoachingRequestService requestService;

    public SkillCoachingRequestController(SkillCoachingRequestService requestService) {
        this.requestService = requestService;
    }

    /**
     * Manager submits skill-development coaching request for 1 or more staff.
     */
    @PostMapping
    @PreAuthorize("hasAuthority('COACHING_REQUEST_SUBMIT')")
    public ApiResponse<SkillCoachingRequestDto> createRequest(
            @Valid @RequestBody CreateSkillCoachingRequestPayload payload,
            @AuthenticationPrincipal ApidUserPrincipal actor
    ) {
        return ApiResponse.ok("Request submitted for PMS approval", requestService.createRequest(payload, actor));
    }

    /**
     * PMS Admin views all skill coaching requests (with optional status & quarter filter).
     */
    @GetMapping
    @PreAuthorize("hasAuthority('COACHING_REQUEST_APPROVE')")
    public ApiResponse<List<SkillCoachingRequestDto>> getAllRequests(
            @RequestParam(required = false) com.boa.apid.coaching.skillrequest.entity.SkillCoachingRequestStatus status,
            @RequestParam(required = false) Long fiscalQuarterId
    ) {
        return ApiResponse.ok(requestService.getAllRequests(status, fiscalQuarterId));
    }

    /**
     * Line manager views their submitted requests.
     */
    @GetMapping("/my-requests")
    @PreAuthorize("hasAuthority('COACHING_REQUEST_SUBMIT')")
    public ApiResponse<List<SkillCoachingRequestDto>> getMyRequests(
            @AuthenticationPrincipal ApidUserPrincipal actor
    ) {
        return ApiResponse.ok(requestService.getMySubmittedRequests(actor));
    }

    /**
     * PMS Admin views pending requests queue.
     */
    @GetMapping("/pending")
    @PreAuthorize("hasAuthority('COACHING_REQUEST_APPROVE')")
    public ApiResponse<List<SkillCoachingRequestDto>> getPendingRequests() {
        return ApiResponse.ok(requestService.getPendingRequests());
    }

    /**
     * PMS Admin approves request and auto-generates coaching assignments.
     */
    @PostMapping("/{id}/approve")
    @PreAuthorize("hasAuthority('COACHING_REQUEST_APPROVE')")
    public ApiResponse<SkillCoachingRequestDto> approveRequest(
            @PathVariable Long id,
            @RequestBody(required = false) ApproveSkillCoachingRequestPayload payload,
            @AuthenticationPrincipal ApidUserPrincipal actor
    ) {
        ApproveSkillCoachingRequestPayload safePayload = payload != null ? payload : new ApproveSkillCoachingRequestPayload(null, null);
        return ApiResponse.ok("Skill coaching request approved", requestService.approveRequest(id, safePayload, actor));
    }

    /**
     * PMS Admin rejects request with mandatory justification.
     */
    @PostMapping("/{id}/reject")
    @PreAuthorize("hasAuthority('COACHING_REQUEST_APPROVE')")
    public ApiResponse<SkillCoachingRequestDto> rejectRequest(
            @PathVariable Long id,
            @Valid @RequestBody RejectSkillCoachingRequestPayload payload,
            @AuthenticationPrincipal ApidUserPrincipal actor
    ) {
        return ApiResponse.ok("Skill coaching request rejected", requestService.rejectRequest(id, payload, actor));
    }
}

