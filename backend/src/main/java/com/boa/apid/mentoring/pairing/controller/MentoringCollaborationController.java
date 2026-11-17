package com.boa.apid.mentoring.pairing.controller;

import com.boa.apid.coaching.session.dto.SessionJoinTokenDto;
import com.boa.apid.common.response.ApiResponse;
import com.boa.apid.core.auth.security.ApidUserPrincipal;
import com.boa.apid.mentoring.pairing.dto.CancelMentoringSessionRequest;
import com.boa.apid.mentoring.pairing.dto.MentoringChatHistoryDto;
import com.boa.apid.mentoring.pairing.dto.MentoringChatMessageDto;
import com.boa.apid.mentoring.pairing.dto.MentoringChatMessageRequest;
import com.boa.apid.mentoring.pairing.dto.MentoringPairingDetailDto;
import com.boa.apid.mentoring.pairing.dto.MentoringSessionDto;
import com.boa.apid.mentoring.pairing.dto.MentoringSessionRequest;
import com.boa.apid.mentoring.pairing.dto.ProposeMentoringRescheduleRequest;
import com.boa.apid.mentoring.pairing.dto.RespondMentoringSessionRequest;
import com.boa.apid.mentoring.pairing.service.MentoringCollaborationService;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/mentoring/pairing/relationships/{relationshipId}")
@PreAuthorize("isAuthenticated() and !principal.mustChangePassword and hasAuthority('EMPLOYEE_PORTAL_ACCESS')")
public class MentoringCollaborationController {

    private final MentoringCollaborationService collaborationService;

    public MentoringCollaborationController(MentoringCollaborationService collaborationService) {
        this.collaborationService = collaborationService;
    }

    @GetMapping
    public ApiResponse<MentoringPairingDetailDto> getPairingDetail(
            @PathVariable Long relationshipId,
            @AuthenticationPrincipal ApidUserPrincipal actor
    ) {
        return ApiResponse.ok(collaborationService.getPairingDetail(relationshipId, actor));
    }

    @GetMapping("/sessions")
    public ApiResponse<List<MentoringSessionDto>> listSessions(
            @PathVariable Long relationshipId,
            @AuthenticationPrincipal ApidUserPrincipal actor
    ) {
        return ApiResponse.ok(collaborationService.listSessions(relationshipId, actor));
    }

    @PostMapping("/sessions")
    public ApiResponse<MentoringSessionDto> createSession(
            @PathVariable Long relationshipId,
            @RequestBody MentoringSessionRequest request,
            @AuthenticationPrincipal ApidUserPrincipal actor
    ) {
        return ApiResponse.ok(
                "Mentoring session scheduled",
                collaborationService.createSession(relationshipId, request, actor)
        );
    }

    @PostMapping("/sessions/{sessionId}/respond")
    public ApiResponse<MentoringSessionDto> respondSession(
            @PathVariable Long relationshipId,
            @PathVariable Long sessionId,
            @RequestBody RespondMentoringSessionRequest request,
            @AuthenticationPrincipal ApidUserPrincipal actor
    ) {
        return ApiResponse.ok(
                request.accept() ? "Mentoring session confirmed" : "Mentoring session declined",
                collaborationService.respondSession(relationshipId, sessionId, request, actor)
        );
    }

    @PostMapping("/sessions/{sessionId}/reschedule")
    public ApiResponse<MentoringSessionDto> proposeReschedule(
            @PathVariable Long relationshipId,
            @PathVariable Long sessionId,
            @RequestBody ProposeMentoringRescheduleRequest request,
            @AuthenticationPrincipal ApidUserPrincipal actor
    ) {
        return ApiResponse.ok(
                "Reschedule proposal submitted",
                collaborationService.proposeReschedule(relationshipId, sessionId, request, actor)
        );
    }

    @PostMapping("/sessions/{sessionId}/respond-reschedule")
    public ApiResponse<MentoringSessionDto> respondReschedule(
            @PathVariable Long relationshipId,
            @PathVariable Long sessionId,
            @RequestParam(defaultValue = "true") boolean accept,
            @AuthenticationPrincipal ApidUserPrincipal actor
    ) {
        return ApiResponse.ok(
                accept ? "Reschedule accepted and session updated" : "Reschedule proposal declined",
                collaborationService.respondReschedule(relationshipId, sessionId, accept, actor)
        );
    }

    @GetMapping("/sessions/{sessionId}/join-token")
    public ApiResponse<SessionJoinTokenDto> getJoinToken(
            @PathVariable Long relationshipId,
            @PathVariable Long sessionId,
            @AuthenticationPrincipal ApidUserPrincipal actor
    ) {
        return ApiResponse.ok(collaborationService.getJoinToken(relationshipId, sessionId, actor));
    }

    @PostMapping("/sessions/{sessionId}/cancel")
    public ApiResponse<MentoringSessionDto> cancelSession(
            @PathVariable Long relationshipId,
            @PathVariable Long sessionId,
            @RequestBody CancelMentoringSessionRequest request,
            @AuthenticationPrincipal ApidUserPrincipal actor
    ) {
        return ApiResponse.ok(
                "Mentoring session cancelled",
                collaborationService.cancelSession(relationshipId, sessionId, request, actor)
        );
    }

    @GetMapping("/messages")
    public ApiResponse<MentoringChatHistoryDto> listMessages(
            @PathVariable Long relationshipId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "50") int size,
            @AuthenticationPrincipal ApidUserPrincipal actor
    ) {
        return ApiResponse.ok(collaborationService.listMessages(relationshipId, page, size, actor));
    }

    @PostMapping("/messages")
    public ApiResponse<MentoringChatMessageDto> sendMessage(
            @PathVariable Long relationshipId,
            @RequestBody MentoringChatMessageRequest request,
            @AuthenticationPrincipal ApidUserPrincipal actor
    ) {
        return ApiResponse.ok(
                "Message sent",
                collaborationService.sendMessage(relationshipId, request, actor)
        );
    }
}
