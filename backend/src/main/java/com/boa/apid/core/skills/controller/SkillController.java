package com.boa.apid.core.skills.controller;

import com.boa.apid.common.response.ApiResponse;
import com.boa.apid.core.auth.security.ApidUserPrincipal;
import com.boa.apid.core.skills.dto.CreateSkillRequest;
import com.boa.apid.core.skills.dto.SkillDto;
import com.boa.apid.core.skills.dto.UpdateSkillRequest;
import com.boa.apid.core.skills.dto.UpdateSkillStatusRequest;
import com.boa.apid.core.skills.service.SkillService;
import jakarta.validation.Valid;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/core")
public class SkillController {

    private final SkillService skillService;

    public SkillController(SkillService skillService) {
        this.skillService = skillService;
    }

    @GetMapping("/skills")
    @PreAuthorize("hasAnyAuthority('EMPLOYEE_PORTAL_ACCESS', 'SKILL_MANAGE', 'COACHING_REQUEST_SUBMIT', 'TRAINER_APPLICATION_REVIEW')")
    public ApiResponse<List<SkillDto>> listActiveSkills(
            @RequestParam(required = false) String search,
            @RequestParam(required = false) String category
    ) {
        return ApiResponse.ok(skillService.listActiveSkills(search, category));
    }

    @GetMapping("/admin/skills")
    @PreAuthorize("hasAuthority('SKILL_MANAGE')")
    public ApiResponse<List<SkillDto>> listAdminSkills(
            @RequestParam(required = false) String search,
            @RequestParam(required = false) String category,
            @RequestParam(required = false) Boolean active
    ) {
        return ApiResponse.ok(skillService.listAllSkillsAdmin(search, category, active));
    }

    @PostMapping("/admin/skills")
    @PreAuthorize("hasAuthority('SKILL_MANAGE')")
    public ApiResponse<SkillDto> createSkill(
            @Valid @RequestBody CreateSkillRequest request,
            @AuthenticationPrincipal ApidUserPrincipal actor
    ) {
        return ApiResponse.ok("Skill created", skillService.createSkill(request, actor));
    }

    @PutMapping("/admin/skills/{id}")
    @PreAuthorize("hasAuthority('SKILL_MANAGE')")
    public ApiResponse<SkillDto> updateSkill(
            @PathVariable Long id,
            @Valid @RequestBody UpdateSkillRequest request,
            @AuthenticationPrincipal ApidUserPrincipal actor
    ) {
        return ApiResponse.ok("Skill updated", skillService.updateSkill(id, request, actor));
    }

    @PatchMapping("/admin/skills/{id}/status")
    @PreAuthorize("hasAuthority('SKILL_MANAGE')")
    public ApiResponse<SkillDto> updateSkillStatus(
            @PathVariable Long id,
            @Valid @RequestBody UpdateSkillStatusRequest request,
            @AuthenticationPrincipal ApidUserPrincipal actor
    ) {
        return ApiResponse.ok("Skill status updated", skillService.updateSkillStatus(id, request, actor));
    }
}

