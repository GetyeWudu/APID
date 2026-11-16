package com.boa.apid.mentoring.matching.controller;

import com.boa.apid.common.response.ApiResponse;
import com.boa.apid.core.auth.security.ApidUserPrincipal;
import com.boa.apid.mentoring.matching.dto.MentoringMatchAssignmentInput;
import com.boa.apid.mentoring.matching.dto.MentoringMatchRequestDto;
import com.boa.apid.mentoring.matching.dto.MentoringMatchRequestInput;
import com.boa.apid.mentoring.matching.dto.MentoringReassignmentCandidateDto;
import com.boa.apid.mentoring.matching.dto.MentoringReassignmentInput;
import com.boa.apid.mentoring.matching.dto.MentoringReassignmentResultDto;
import com.boa.apid.mentoring.matching.service.MentoringMatchService;
import jakarta.validation.Valid;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/mentoring")
public class MentoringMatchController {

    private final MentoringMatchService matchService;

    public MentoringMatchController(MentoringMatchService matchService) {
        this.matchService = matchService;
    }

    @GetMapping("/match-requests")
    @PreAuthorize("isAuthenticated() and !principal.mustChangePassword and hasAuthority('EMPLOYEE_PORTAL_ACCESS')")
    public ApiResponse<List<MentoringMatchRequestDto>> listMyRequests(
            @AuthenticationPrincipal ApidUserPrincipal actor
    ) {
        return ApiResponse.ok(matchService.listForEmployee(actor));
    }

    @PostMapping("/match-requests")
    @PreAuthorize("isAuthenticated() and !principal.mustChangePassword and hasAuthority('EMPLOYEE_PORTAL_ACCESS')")
    public ApiResponse<MentoringMatchRequestDto> submit(
            @Valid @RequestBody MentoringMatchRequestInput request,
            @AuthenticationPrincipal ApidUserPrincipal actor
    ) {
        return ApiResponse.ok("HR matching request submitted", matchService.submit(request, actor));
    }

    @GetMapping("/hr/match-requests")
    @PreAuthorize("hasAuthority('MENTORING_MATCH_MANAGE')")
    public ApiResponse<List<MentoringMatchRequestDto>> listForHr() {
        return ApiResponse.ok(matchService.listForHr());
    }

    @PostMapping("/hr/match-requests/{requestId}/match")
    @PreAuthorize("hasAuthority('MENTORING_MATCH_MANAGE')")
    public ApiResponse<MentoringMatchRequestDto> match(
            @PathVariable Long requestId,
            @Valid @RequestBody MentoringMatchAssignmentInput input,
            @AuthenticationPrincipal ApidUserPrincipal actor
    ) {
        return ApiResponse.ok("Trainee matched with trainer", matchService.match(requestId, input, actor));
    }

    @GetMapping("/hr/reassignment-queue")
    @PreAuthorize("hasAnyAuthority('MENTORING_MATCH_MANAGE', 'TRAINER_STATUS_MANAGE')")
    public ApiResponse<List<MentoringReassignmentCandidateDto>> listReassignmentQueue() {
        return ApiResponse.ok(matchService.listReassignmentQueue());
    }

    @PostMapping("/hr/relationships/{relationshipId}/reassign")
    @PreAuthorize("hasAnyAuthority('MENTORING_MATCH_MANAGE', 'TRAINER_STATUS_MANAGE')")
    public ApiResponse<MentoringReassignmentResultDto> reassign(
            @PathVariable Long relationshipId,
            @Valid @RequestBody MentoringReassignmentInput input,
            @AuthenticationPrincipal ApidUserPrincipal actor
    ) {
        return ApiResponse.ok(
                "Mentoring relationship reassigned",
                matchService.reassign(relationshipId, input, actor)
        );
    }
}
