package com.boa.apid.coaching.referral.controller;

import com.boa.apid.coaching.referral.dto.PmsReferralCaseDto;
import com.boa.apid.coaching.referral.dto.ResolveReferralRequest;
import com.boa.apid.coaching.referral.service.PmsReferralService;
import com.boa.apid.common.response.ApiResponse;
import com.boa.apid.core.auth.security.ApidUserPrincipal;
import jakarta.validation.Valid;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/coaching/referrals")
public class PmsReferralController {

    private final PmsReferralService referralService;

    public PmsReferralController(PmsReferralService referralService) {
        this.referralService = referralService;
    }

    @GetMapping
    @PreAuthorize("hasAnyAuthority('COACHING_ASSIGNMENT_VIEW_ALL', 'COACHING_COACH_REPLACE', 'COACHING_MANAGE', 'ROLE_PMS_ADMIN', 'ROLE_SUPER_ADMIN')")
    public ApiResponse<List<PmsReferralCaseDto>> getAllReferrals(
            @RequestParam(value = "status", required = false) String status
    ) {
        return ApiResponse.ok(referralService.getAllReferrals(status));
    }

    @PostMapping("/scan")
    @PreAuthorize("hasAnyAuthority('COACHING_ASSIGNMENT_VIEW_ALL', 'COACHING_COACH_REPLACE', 'COACHING_MANAGE', 'ROLE_PMS_ADMIN', 'ROLE_SUPER_ADMIN')")
    public ApiResponse<Map<String, Object>> scanAndDetectReferrals() {
        int count = referralService.scanAndDetectReferrals();
        return ApiResponse.ok(Map.of(
                "newReferralsGenerated", count,
                "scannedAt", Instant.now().toString()
        ));
    }

    @PostMapping("/{id:\\d+}/resolve")
    @PreAuthorize("hasAnyAuthority('COACHING_COACH_REPLACE', 'COACHING_MANAGE', 'ROLE_PMS_ADMIN', 'ROLE_SUPER_ADMIN')")
    public ApiResponse<PmsReferralCaseDto> resolveReferral(
            @PathVariable Long id,
            @Valid @RequestBody ResolveReferralRequest request,
            @AuthenticationPrincipal ApidUserPrincipal actor
    ) {
        return ApiResponse.ok(referralService.resolveReferral(id, request, actor));
    }
}
