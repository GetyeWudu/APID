package com.boa.apid.mentoring.recommendation.controller;

import com.boa.apid.common.response.ApiResponse;
import com.boa.apid.core.auth.security.ApidUserPrincipal;
import com.boa.apid.mentoring.recommendation.dto.MentorRecommendationRequest;
import com.boa.apid.mentoring.recommendation.dto.MentorRecommendationResponse;
import com.boa.apid.mentoring.recommendation.service.MentorRecommendationService;
import jakarta.validation.Valid;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/mentoring/recommendations")
public class MentorRecommendationController {

    private final MentorRecommendationService recommendationService;

    public MentorRecommendationController(MentorRecommendationService recommendationService) {
        this.recommendationService = recommendationService;
    }

    @PostMapping
    @PreAuthorize("isAuthenticated() and !principal.mustChangePassword and hasAuthority('EMPLOYEE_PORTAL_ACCESS')")
    public ApiResponse<MentorRecommendationResponse> recommend(
            @Valid @RequestBody MentorRecommendationRequest request,
            @AuthenticationPrincipal ApidUserPrincipal actor
    ) {
        return ApiResponse.ok(recommendationService.recommend(request, actor.getUserId()));
    }
}
