package com.boa.apid.core.identity.controller;

import com.boa.apid.common.response.ApiResponse;
import com.boa.apid.core.auth.security.ApidUserPrincipal;
import com.boa.apid.core.authorization.entity.UserStatus;
import com.boa.apid.core.identity.dto.*;
import com.boa.apid.core.identity.service.UserAdminService;
import jakarta.validation.Valid;
import org.springframework.data.domain.Page;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/core/admin/users")
public class UserAdminController {

    private final UserAdminService userAdminService;

    public UserAdminController(UserAdminService userAdminService) {
        this.userAdminService = userAdminService;
    }

    @GetMapping
    @PreAuthorize("hasAuthority('USER_MANAGE')")
    public ApiResponse<Page<AdminUserDto>> searchUsers(
            @RequestParam(required = false) String search,
            @RequestParam(required = false) UserStatus status,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(defaultValue = "createdAt") String sortBy,
            @RequestParam(defaultValue = "desc") String sortDir
    ) {
        return ApiResponse.ok(userAdminService.searchUsers(search, status, page, size, sortBy, sortDir));
    }

    @PostMapping
    @PreAuthorize("hasAuthority('USER_MANAGE')")
    public ApiResponse<CreateUserResponse> createUser(
            @Valid @RequestBody CreateUserRequest request,
            @AuthenticationPrincipal ApidUserPrincipal actor
    ) {
        return ApiResponse.ok("User created successfully", userAdminService.createUser(request, actor));
    }

    @PatchMapping("/{id}/status")
    @PreAuthorize("hasAuthority('USER_MANAGE')")
    public ApiResponse<AdminUserDto> updateStatus(
            @PathVariable Long id,
            @Valid @RequestBody UpdateUserStatusRequest request,
            @AuthenticationPrincipal ApidUserPrincipal actor
    ) {
        return ApiResponse.ok("User status updated", userAdminService.updateStatus(id, request, actor));
    }

    @PostMapping("/{id}/unlock")
    @PreAuthorize("hasAuthority('USER_MANAGE')")
    public ApiResponse<AdminUserDto> unlockTemporaryLock(
            @PathVariable Long id,
            @AuthenticationPrincipal ApidUserPrincipal actor
    ) {
        return ApiResponse.ok("Temporary lockout cleared", userAdminService.unlockTemporaryLock(id, actor));
    }

    @PostMapping("/{id}/reset-password")
    @PreAuthorize("hasAuthority('USER_MANAGE')")
    public ApiResponse<PasswordResetResponse> resetPassword(
            @PathVariable Long id,
            @AuthenticationPrincipal ApidUserPrincipal actor
    ) {
        return ApiResponse.ok("Temporary password generated", userAdminService.resetPassword(id, actor));
    }

    @PutMapping("/{id}/roles")
    @PreAuthorize("hasAuthority('USER_MANAGE')")
    public ApiResponse<AdminUserDto> updateUserRoles(
            @PathVariable Long id,
            @Valid @RequestBody UpdateUserRolesRequest request,
            @AuthenticationPrincipal ApidUserPrincipal actor
    ) {
        return ApiResponse.ok("User roles updated", userAdminService.updateUserRoles(id, request, actor));
    }
}

