package com.boa.apid.mentoring.pairing.controller;

import com.boa.apid.common.response.ApiResponse;
import com.boa.apid.core.auth.security.ApidUserPrincipal;
import com.boa.apid.mentoring.pairing.dto.CreateGroupPairingRequest;
import com.boa.apid.mentoring.pairing.dto.CreateGroupSessionRequest;
import com.boa.apid.mentoring.pairing.dto.GroupPairingDto;
import com.boa.apid.mentoring.pairing.dto.MentoringSessionDto;
import com.boa.apid.mentoring.pairing.service.MentoringGroupPairingService;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@PreAuthorize("isAuthenticated() and !principal.mustChangePassword and hasAuthority('EMPLOYEE_PORTAL_ACCESS')")
public class MentoringGroupPairingController {

    private final MentoringGroupPairingService groupPairingService;

    public MentoringGroupPairingController(MentoringGroupPairingService groupPairingService) {
        this.groupPairingService = groupPairingService;
    }

    /** Bundle 2+ individual pairings into a group cohort. */
    @PostMapping("/api/v1/mentoring/pairing/group")
    public ApiResponse<GroupPairingDto> createGroupPairing(
            @RequestBody CreateGroupPairingRequest request,
            @AuthenticationPrincipal ApidUserPrincipal actor
    ) {
        return ApiResponse.ok(
                "Group mentoring cohort created",
                groupPairingService.createGroupPairing(request, actor)
        );
    }

    /** Disband a group, restoring each original 1-on-1 pairing to ACTIVE. */
    @DeleteMapping("/api/v1/mentoring/pairing/group/{groupRelationshipId}")
    public ApiResponse<String> disbandGroupPairing(
            @PathVariable Long groupRelationshipId,
            @AuthenticationPrincipal ApidUserPrincipal actor
    ) {
        groupPairingService.disbandGroupPairing(groupRelationshipId, actor);
        return ApiResponse.ok("Group pairing disbanded. Original 1-on-1 pairings restored.");
    }

    /** Create a cross-pairing group session for ≥2 trainees from different 1-on-1 pairings. */
    @PostMapping("/api/v1/mentoring/pairing/sessions/group")
    public ApiResponse<MentoringSessionDto> createGroupSession(
            @RequestBody CreateGroupSessionRequest request,
            @AuthenticationPrincipal ApidUserPrincipal actor
    ) {
        return ApiResponse.ok(
                "Group session scheduled",
                groupPairingService.createGroupSession(request, actor)
        );
    }
}
