package com.boa.apid.coaching.governance.controller;

import com.boa.apid.coaching.assignment.entity.AssignmentPathway;
import com.boa.apid.coaching.governance.dto.*;
import com.boa.apid.coaching.governance.service.CoachingGovernanceService;
import com.boa.apid.coaching.governance.service.ScheduleSeriesGeneratorService;
import com.boa.apid.common.response.ApiResponse;
import com.boa.apid.core.auth.security.ApidUserPrincipal;
import jakarta.validation.Valid;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/coaching/governance")
public class CoachingGovernanceController {

    private final CoachingGovernanceService governanceService;
    private final ScheduleSeriesGeneratorService seriesGeneratorService;

    public CoachingGovernanceController(
            CoachingGovernanceService governanceService,
            ScheduleSeriesGeneratorService seriesGeneratorService
    ) {
        this.governanceService = governanceService;
        this.seriesGeneratorService = seriesGeneratorService;
    }

    @GetMapping("/policies")
    @PreAuthorize("hasAuthority('EMPLOYEE_PORTAL_ACCESS')")
    public ApiResponse<List<CoachingPolicyVersionDto>> getPolicies(
            @RequestParam(value = "pathway", required = false) AssignmentPathway pathway
    ) {
        return ApiResponse.ok(governanceService.getActivePolicies(pathway));
    }

    @PutMapping("/policies/{id:\\d+}")
    @PreAuthorize("hasAnyAuthority('PMS_REPORT_UPLOAD', 'COACHING_REQUEST_APPROVE', 'COACHING_INITIATIVE_CREATE', 'ROLE_ADMIN')")
    public ApiResponse<CoachingPolicyVersionDto> updatePolicy(
            @PathVariable Long id,
            @Valid @RequestBody UpdateCoachingPolicyRequest request,
            @AuthenticationPrincipal ApidUserPrincipal actor
    ) {
        return ApiResponse.ok(governanceService.updatePolicy(id, request, actor));
    }

    @PostMapping("/policies")
    @PreAuthorize("hasAnyAuthority('PMS_REPORT_UPLOAD', 'COACHING_REQUEST_APPROVE', 'COACHING_INITIATIVE_CREATE', 'ROLE_ADMIN')")
    public ApiResponse<CoachingPolicyVersionDto> createPolicy(
            @Valid @RequestBody CreateCoachingPolicyRequest request,
            @AuthenticationPrincipal ApidUserPrincipal actor
    ) {
        return ApiResponse.ok(governanceService.createPolicy(request, actor));
    }

    @GetMapping("/target")
    @PreAuthorize("hasAuthority('EMPLOYEE_PORTAL_ACCESS')")
    public ApiResponse<CoachingSessionTargetDto> getTarget(
            @RequestParam(value = "assignmentId", required = false) Long assignmentId,
            @RequestParam(value = "skillRequestId", required = false) Long skillRequestId
    ) {
        return ApiResponse.ok(governanceService.getOrCreateTarget(assignmentId, skillRequestId));
    }

    @PostMapping("/target/propose")
    @PreAuthorize("hasAuthority('EMPLOYEE_PORTAL_ACCESS')")
    public ApiResponse<CoachingSessionTargetDto> proposeTarget(
            @Valid @RequestBody ProposeTargetRequest request,
            @AuthenticationPrincipal ApidUserPrincipal actor
    ) {
        return ApiResponse.ok(governanceService.proposeTargetAdjustment(request, actor));
    }

    @PostMapping("/adjustments/{id:\\d+}/review")
    @PreAuthorize("hasAnyAuthority('PMS_REPORT_UPLOAD', 'COACHING_REQUEST_APPROVE', 'COACHING_INITIATIVE_CREATE', 'ROLE_ADMIN')")
    public ApiResponse<CoachingSessionTargetDto> reviewAdjustment(
            @PathVariable Long id,
            @Valid @RequestBody ReviewAdjustmentRequest request,
            @AuthenticationPrincipal ApidUserPrincipal actor
    ) {
        return ApiResponse.ok(governanceService.reviewAdjustment(id, request, actor));
    }

    @PostMapping("/target/{id:\\d+}/extend")
    @PreAuthorize("hasAuthority('EMPLOYEE_PORTAL_ACCESS')")
    public ApiResponse<CoachingSessionTargetDto> requestExtension(
            @PathVariable Long id,
            @Valid @RequestBody RequestExtensionRequest request,
            @AuthenticationPrincipal ApidUserPrincipal actor
    ) {
        return ApiResponse.ok(governanceService.requestExtension(id, request, actor));
    }

    @PostMapping("/target/{id:\\d+}/early-complete")
    @PreAuthorize("hasAuthority('EMPLOYEE_PORTAL_ACCESS')")
    public ApiResponse<CoachingSessionTargetDto> requestEarlyCompletion(
            @PathVariable Long id,
            @Valid @RequestBody RequestEarlyCompletionRequest request,
            @AuthenticationPrincipal ApidUserPrincipal actor
    ) {
        return ApiResponse.ok(governanceService.requestEarlyCompletion(id, request, actor));
    }

    @PostMapping("/series/preview")
    @PreAuthorize("hasAuthority('EMPLOYEE_PORTAL_ACCESS')")
    public ApiResponse<SeriesPreviewResponse> previewSeries(
            @Valid @RequestBody SeriesPreviewRequest request
    ) {
        return ApiResponse.ok(seriesGeneratorService.previewSeries(request));
    }

    @PostMapping("/series")
    @PreAuthorize("hasAuthority('EMPLOYEE_PORTAL_ACCESS')")
    public ApiResponse<ScheduleSeriesDto> createSeries(
            @Valid @RequestBody CreateScheduleSeriesRequest request,
            @AuthenticationPrincipal ApidUserPrincipal actor
    ) {
        return ApiResponse.ok(seriesGeneratorService.createSeries(request, actor));
    }
}
