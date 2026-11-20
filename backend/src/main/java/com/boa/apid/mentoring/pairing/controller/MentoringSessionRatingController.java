package com.boa.apid.mentoring.pairing.controller;

import com.boa.apid.common.response.ApiResponse;
import com.boa.apid.core.auth.security.ApidUserPrincipal;
import com.boa.apid.mentoring.pairing.dto.MentorSessionRatingDto;
import com.boa.apid.mentoring.pairing.dto.MentoringSessionRatingDto;
import com.boa.apid.mentoring.pairing.dto.MentoringSessionRatingRequest;
import com.boa.apid.mentoring.pairing.service.MentoringSessionRatingService;
import jakarta.validation.Valid;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/mentoring/pairing")
@PreAuthorize("isAuthenticated() and !principal.mustChangePassword and hasAuthority('EMPLOYEE_PORTAL_ACCESS')")
public class MentoringSessionRatingController {

    private final MentoringSessionRatingService ratingService;

    public MentoringSessionRatingController(MentoringSessionRatingService ratingService) {
        this.ratingService = ratingService;
    }

    @GetMapping("/relationships/{relationshipId}/sessions/{sessionId}/rating")
    public ApiResponse<MentoringSessionRatingDto> getMySessionRating(
            @PathVariable Long relationshipId,
            @PathVariable Long sessionId,
            @AuthenticationPrincipal ApidUserPrincipal actor
    ) {
        return ApiResponse.ok(ratingService.getMySessionRating(relationshipId, sessionId, actor.getUserId()));
    }

    @PostMapping("/relationships/{relationshipId}/sessions/{sessionId}/rating")
    public ApiResponse<MentoringSessionRatingDto> rateSession(
            @PathVariable Long relationshipId,
            @PathVariable Long sessionId,
            @Valid @RequestBody MentoringSessionRatingRequest request,
            @AuthenticationPrincipal ApidUserPrincipal actor
    ) {
        return ApiResponse.ok(
                "Session rating submitted",
                ratingService.rateSession(relationshipId, sessionId, request, actor.getUserId())
        );
    }

    @GetMapping("/mentor-rating/me")
    public ApiResponse<MentorSessionRatingDto> getMyMentorRating(
            @AuthenticationPrincipal ApidUserPrincipal actor
    ) {
        return ApiResponse.ok(ratingService.getMyMentorRating(actor.getUserId()));
    }
}
