package com.boa.apid.coaching.skillrequest.controller;

import com.boa.apid.coaching.skillrequest.dto.*;
import com.boa.apid.coaching.skillrequest.service.SkillCoachingRequestService;
import com.boa.apid.common.response.ApiResponse;
import com.boa.apid.core.auth.security.ApidUserPrincipal;
import com.boa.apid.core.organization.dto.EmployeeDto;
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
     * Employee views approved skill development cohorts they belong to (as target or coach).
     * If asTalentOnly=true, only returns cohorts where caller is an enrolled talent and has peers to chat with.
     */
    @GetMapping("/my-cohorts")
    @PreAuthorize("hasAuthority('EMPLOYEE_PORTAL_ACCESS')")
    public ApiResponse<List<SkillCoachingRequestDto>> getMyApprovedCohorts(
            @RequestParam(value = "asTalentOnly", required = false, defaultValue = "false") boolean asTalentOnly,
            @AuthenticationPrincipal ApidUserPrincipal actor
    ) {
        return ApiResponse.ok(requestService.getMyApprovedCohorts(actor, asTalentOnly));
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

    /**
     * Coach or nominating manager adds an additional employee directly to an approved skill cohort.
     */
    @PostMapping("/{id}/members")
    @PreAuthorize("hasAuthority('COACHING_REQUEST_SUBMIT') or hasAuthority('COACHING_SESSION_SCHEDULE')")
    public ApiResponse<SkillCoachingRequestDto> addCohortMember(
            @PathVariable Long id,
            @Valid @RequestBody AddCohortMemberPayload payload,
            @AuthenticationPrincipal ApidUserPrincipal actor
    ) {
        return ApiResponse.ok("Employee added to cohort", requestService.addCohortMember(id, payload.employeeId(), actor));
    }

    /**
     * Retrieves eligible direct reports under this cohort's coach available to be added.
     */
    @GetMapping("/{id}/eligible-members")
    @PreAuthorize("hasAuthority('COACHING_REQUEST_SUBMIT') or hasAuthority('COACHING_SESSION_SCHEDULE')")
    public ApiResponse<List<EmployeeDto>> getEligibleCohortMembers(
            @PathVariable Long id,
            @AuthenticationPrincipal ApidUserPrincipal actor
    ) {
        return ApiResponse.ok(requestService.getEligibleCohortMembers(id, actor));
    }

    /**
     * Coach or nominating manager removes an employee from an approved skill cohort.
     */
    @DeleteMapping("/{id}/members/{employeeId}")
    @PreAuthorize("hasAuthority('COACHING_REQUEST_SUBMIT') or hasAuthority('COACHING_SESSION_SCHEDULE')")
    public ApiResponse<SkillCoachingRequestDto> removeCohortMember(
            @PathVariable Long id,
            @PathVariable Long employeeId,
            @AuthenticationPrincipal ApidUserPrincipal actor
    ) {
        return ApiResponse.ok("Employee removed from cohort", requestService.removeCohortMember(id, employeeId, actor));
    }
}

