package com.boa.apid.coaching.session.controller;

import com.boa.apid.coaching.assignment.entity.AssignmentPathway;
import com.boa.apid.coaching.session.dto.*;
import com.boa.apid.coaching.session.service.CoachingSessionService;
import com.boa.apid.common.response.ApiResponse;
import com.boa.apid.core.auth.security.ApidUserPrincipal;
import jakarta.validation.Valid;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/coaching/sessions")
public class CoachingSessionController {

    private final CoachingSessionService sessionService;

    public CoachingSessionController(CoachingSessionService sessionService) {
        this.sessionService = sessionService;
    }

    @PostMapping
    @PreAuthorize("hasAuthority('EMPLOYEE_PORTAL_ACCESS')")
    public ApiResponse<CoachingSessionDto> createSession(
            @Valid @RequestBody CreateSessionRequest request,
            @AuthenticationPrincipal ApidUserPrincipal actor
    ) {
        return ApiResponse.ok(sessionService.createSession(request, actor));
    }

    @GetMapping
    @PreAuthorize("hasAuthority('EMPLOYEE_PORTAL_ACCESS')")
    public ApiResponse<List<CoachingSessionDto>> getMySessions(
            @RequestParam(value = "upcomingOnly", required = false) Boolean upcomingOnly,
            @RequestParam(value = "pathway", required = false) AssignmentPathway pathway,
            @AuthenticationPrincipal ApidUserPrincipal actor
    ) {
        return ApiResponse.ok(sessionService.getMySessions(actor, upcomingOnly, pathway));
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAuthority('EMPLOYEE_PORTAL_ACCESS')")
    public ApiResponse<CoachingSessionDto> getSessionDetail(
            @PathVariable Long id,
            @AuthenticationPrincipal ApidUserPrincipal actor
    ) {
        return ApiResponse.ok(sessionService.getSessionDetail(id, actor));
    }

    @PostMapping("/{id}/respond")
    @PreAuthorize("hasAuthority('EMPLOYEE_PORTAL_ACCESS')")
    public ApiResponse<CoachingSessionDto> respondInvitation(
            @PathVariable Long id,
            @RequestBody RespondInvitationRequest request,
            @AuthenticationPrincipal ApidUserPrincipal actor
    ) {
        return ApiResponse.ok(sessionService.respondInvitation(id, request, actor));
    }

    @PostMapping("/{id}/reschedule")
    @PreAuthorize("hasAuthority('EMPLOYEE_PORTAL_ACCESS')")
    public ApiResponse<CoachingSessionDto> proposeReschedule(
            @PathVariable Long id,
            @Valid @RequestBody ProposeRescheduleRequest request,
            @AuthenticationPrincipal ApidUserPrincipal actor
    ) {
        return ApiResponse.ok(sessionService.proposeReschedule(id, request, actor));
    }

    @PostMapping("/{id}/cancel")
    @PreAuthorize("hasAuthority('EMPLOYEE_PORTAL_ACCESS')")
    public ApiResponse<CoachingSessionDto> cancelSession(
            @PathVariable Long id,
            @Valid @RequestBody CancelSessionRequest request,
            @AuthenticationPrincipal ApidUserPrincipal actor
    ) {
        return ApiResponse.ok(sessionService.cancelSession(id, request, actor));
    }

    @PostMapping("/{id}/complete")
    @PreAuthorize("hasAuthority('EMPLOYEE_PORTAL_ACCESS')")
    public ApiResponse<CoachingSessionDto> completeSession(
            @PathVariable Long id,
            @Valid @RequestBody CompleteSessionRequest request,
            @AuthenticationPrincipal ApidUserPrincipal actor
    ) {
        return ApiResponse.ok(sessionService.completeSession(id, request, actor));
    }

    @PostMapping("/{id}/feedback")
    @PreAuthorize("hasAuthority('EMPLOYEE_PORTAL_ACCESS')")
    public ApiResponse<CoachingSessionDto> submitFeedback(
            @PathVariable Long id,
            @Valid @RequestBody SubmitFeedbackRequest request,
            @AuthenticationPrincipal ApidUserPrincipal actor
    ) {
        return ApiResponse.ok(sessionService.submitFeedback(id, request, actor));
    }

    @GetMapping("/{id}/join-token")
    @PreAuthorize("hasAuthority('EMPLOYEE_PORTAL_ACCESS')")
    public ApiResponse<SessionJoinTokenDto> getJoinToken(
            @PathVariable Long id,
            @AuthenticationPrincipal ApidUserPrincipal actor
    ) {
        return ApiResponse.ok(sessionService.getJoinToken(id, actor));
    }
}

