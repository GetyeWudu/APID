package com.boa.apid.core.notifications.controller;

import com.boa.apid.common.response.ApiResponse;
import com.boa.apid.core.auth.security.ApidUserPrincipal;
import com.boa.apid.core.notifications.dto.MarkAllReadResultDto;
import com.boa.apid.core.notifications.dto.NotificationDto;
import com.boa.apid.core.notifications.dto.NotificationPageDto;
import com.boa.apid.core.notifications.service.NotificationService;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/core/notifications")
public class NotificationController {

    private final NotificationService notificationService;

    public NotificationController(NotificationService notificationService) {
        this.notificationService = notificationService;
    }

    @GetMapping
    @PreAuthorize("isAuthenticated() and !principal.mustChangePassword")
    public ApiResponse<NotificationPageDto> listMyNotifications(
            @AuthenticationPrincipal ApidUserPrincipal actor,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(defaultValue = "false") boolean unreadOnly
    ) {
        return ApiResponse.ok(notificationService.listMyNotifications(actor.getUserId(), page, size, unreadOnly));
    }

    @PatchMapping("/{id}/read")
    @PreAuthorize("isAuthenticated() and !principal.mustChangePassword")
    public ApiResponse<NotificationDto> markRead(
            @PathVariable Long id,
            @AuthenticationPrincipal ApidUserPrincipal actor
    ) {
        return ApiResponse.ok(notificationService.markRead(id, actor.getUserId()));
    }

    @PostMapping("/read-all")
    @PreAuthorize("isAuthenticated() and !principal.mustChangePassword")
    public ApiResponse<MarkAllReadResultDto> markAllRead(@AuthenticationPrincipal ApidUserPrincipal actor) {
        return ApiResponse.ok("Notifications marked as read", notificationService.markAllRead(actor.getUserId()));
    }
}
