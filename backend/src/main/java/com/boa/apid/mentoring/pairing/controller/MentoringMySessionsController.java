package com.boa.apid.mentoring.pairing.controller;

import com.boa.apid.common.response.ApiResponse;
import com.boa.apid.core.auth.security.ApidUserPrincipal;
import com.boa.apid.mentoring.pairing.dto.MentoringSessionDto;
import com.boa.apid.mentoring.pairing.service.MentoringCollaborationService;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/v1/mentoring/pairing/sessions")
@PreAuthorize("isAuthenticated() and !principal.mustChangePassword and hasAuthority('EMPLOYEE_PORTAL_ACCESS')")
public class MentoringMySessionsController {

    private final MentoringCollaborationService collaborationService;

    public MentoringMySessionsController(MentoringCollaborationService collaborationService) {
        this.collaborationService = collaborationService;
    }

    @GetMapping
    public ApiResponse<List<MentoringSessionDto>> listMySessions(
            @AuthenticationPrincipal ApidUserPrincipal actor
    ) {
        return ApiResponse.ok(collaborationService.listMySessions(actor));
    }
}
