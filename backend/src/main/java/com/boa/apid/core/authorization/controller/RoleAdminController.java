package com.boa.apid.core.authorization.controller;

import com.boa.apid.common.response.ApiResponse;
import com.boa.apid.core.auth.security.ApidUserPrincipal;
import com.boa.apid.core.authorization.dto.*;
import com.boa.apid.core.authorization.service.RoleAdminService;
import jakarta.validation.Valid;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/core/admin")
public class RoleAdminController {

    private final RoleAdminService roleAdminService;

    public RoleAdminController(RoleAdminService roleAdminService) {
        this.roleAdminService = roleAdminService;
    }

    @GetMapping("/permissions")
    @PreAuthorize("hasAuthority('ROLE_PERMISSION_MANAGE')")
    public ApiResponse<List<PermissionDto>> listPermissions() {
        return ApiResponse.ok(roleAdminService.listAllPermissions());
    }

    @GetMapping("/roles")
    @PreAuthorize("hasAuthority('ROLE_PERMISSION_MANAGE') or hasAuthority('USER_MANAGE')")
    public ApiResponse<List<RoleDto>> listRoles() {
        return ApiResponse.ok(roleAdminService.listAllRoles());
    }

    @PostMapping("/roles")
    @PreAuthorize("hasAuthority('ROLE_PERMISSION_MANAGE')")
    public ApiResponse<RoleDto> createRole(
            @Valid @RequestBody CreateRoleRequest request,
            @AuthenticationPrincipal ApidUserPrincipal actor
    ) {
        return ApiResponse.ok("Role created", roleAdminService.createRole(request, actor));
    }

    @PutMapping("/roles/{id}")
    @PreAuthorize("hasAuthority('ROLE_PERMISSION_MANAGE')")
    public ApiResponse<RoleDto> updateRole(
            @PathVariable Long id,
            @Valid @RequestBody UpdateRoleRequest request,
            @AuthenticationPrincipal ApidUserPrincipal actor
    ) {
        return ApiResponse.ok("Role updated", roleAdminService.updateRole(id, request, actor));
    }

    @PutMapping("/roles/{id}/permissions")
    @PreAuthorize("hasAuthority('ROLE_PERMISSION_MANAGE')")
    public ApiResponse<RoleDto> updateRolePermissions(
            @PathVariable Long id,
            @Valid @RequestBody UpdateRolePermissionsRequest request,
            @AuthenticationPrincipal ApidUserPrincipal actor
    ) {
        return ApiResponse.ok("Role permissions updated", roleAdminService.updateRolePermissions(id, request, actor));
    }
}

