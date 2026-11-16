package com.boa.apid.mentoring.pairing.controller;

import com.boa.apid.common.response.ApiResponse;
import com.boa.apid.core.auth.security.ApidUserPrincipal;
import com.boa.apid.mentoring.pairing.dto.MentoringChatHistoryDto;
import com.boa.apid.mentoring.pairing.dto.MentoringChatMessageDto;
import com.boa.apid.mentoring.pairing.dto.MentoringChatMessageRequest;
import com.boa.apid.mentoring.pairing.dto.MentoringPairingDetailDto;
import com.boa.apid.mentoring.pairing.dto.MentoringSessionDto;
import com.boa.apid.mentoring.pairing.dto.MentoringSessionRequest;
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
