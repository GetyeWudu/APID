package com.boa.apid.mentoring.pairing.controller;

import com.boa.apid.common.response.ApiResponse;
import com.boa.apid.core.auth.security.ApidUserPrincipal;
import com.boa.apid.mentoring.pairing.dto.MentorInvitationRequest;
import com.boa.apid.mentoring.pairing.dto.MentoringEmployeeCandidateDto;
import com.boa.apid.mentoring.pairing.dto.MentoringPairingDto;
import com.boa.apid.mentoring.pairing.dto.MentoringRelationshipPairDto;
import com.boa.apid.mentoring.pairing.dto.MentoringRequestDecision;
import com.boa.apid.mentoring.pairing.dto.TraineeMentorRequest;
import com.boa.apid.mentoring.pairing.service.MentoringPairingService;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/mentoring/pairing")
@PreAuthorize("isAuthenticated() and !principal.mustChangePassword and hasAnyAuthority('EMPLOYEE_PORTAL_ACCESS', 'COACHING_REQUEST_SUBMIT')")
public class MentoringPairingController {

    private final MentoringPairingService pairingService;

    public MentoringPairingController(MentoringPairingService pairingService) {
        this.pairingService = pairingService;
    }

    @GetMapping("/employees")
    public ApiResponse<List<MentoringEmployeeCandidateDto>> listEmployeeCandidates(
            @AuthenticationPrincipal ApidUserPrincipal actor
    ) {
        return ApiResponse.ok(pairingService.listEmployeeCandidates(actor));
    }

    @GetMapping("/requests")
    public ApiResponse<List<MentoringPairingDto>> listMyRequests(
            @AuthenticationPrincipal ApidUserPrincipal actor
    ) {
        return ApiResponse.ok(pairingService.listMyRequests(actor));
    }

    @GetMapping("/relationships")
    public ApiResponse<List<MentoringRelationshipPairDto>> listMyRelationships(
            @AuthenticationPrincipal ApidUserPrincipal actor
    ) {
        return ApiResponse.ok(pairingService.listMyRelationships(actor));
    }

    @PostMapping("/requests/invitations")
    public ApiResponse<List<MentoringPairingDto>> inviteTrainees(
            @RequestBody MentorInvitationRequest request,
            @AuthenticationPrincipal ApidUserPrincipal actor
    ) {
        return ApiResponse.ok("Mentoring invitation sent", pairingService.inviteTrainees(request, actor));
    }

    @PostMapping("/requests/mentors")
    public ApiResponse<MentoringPairingDto> requestMentor(
            @RequestBody TraineeMentorRequest request,
            @AuthenticationPrincipal ApidUserPrincipal actor
    ) {
        return ApiResponse.ok("Mentorship request sent", pairingService.requestMentor(request, actor));
    }

    @PostMapping("/requests/{recipientId}/decision")
    public ApiResponse<MentoringPairingDto> respond(
            @PathVariable Long recipientId,
            @RequestBody MentoringRequestDecision decision,
            @AuthenticationPrincipal ApidUserPrincipal actor
    ) {
        return ApiResponse.ok("Mentoring request handled", pairingService.respond(recipientId, decision, actor));
    }
}
