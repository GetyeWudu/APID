package com.boa.apid.core.notifications.dto;

import com.boa.apid.core.notifications.entity.Notification;
import com.boa.apid.core.notifications.entity.NotificationModule;

import java.time.Instant;

public record NotificationDto(
        Long id,
        NotificationModule module,
        String eventType,
        String title,
        String message,
        String deepLink,
        boolean read,
        Instant readAt,
        Instant createdAt
) {
    public static NotificationDto from(Notification entity) {
        return new NotificationDto(
                entity.getId(),
                entity.getModule(),
                entity.getEventType(),
                entity.getTitle(),
                entity.getMessage(),
                entity.getDeepLink(),
                entity.isRead(),
                entity.getReadAt(),
                entity.getCreatedAt()
        );
    }
}

