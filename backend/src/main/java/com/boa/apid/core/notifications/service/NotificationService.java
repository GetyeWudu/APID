package com.boa.apid.core.notifications.service;

import com.boa.apid.common.exception.ResourceNotFoundException;
import com.boa.apid.core.notifications.dto.MarkAllReadResultDto;
import com.boa.apid.core.notifications.dto.NotificationDto;
import com.boa.apid.core.notifications.dto.NotificationPageDto;
import com.boa.apid.core.notifications.entity.*;
import com.boa.apid.core.notifications.repository.NotificationOutboxRepository;
import com.boa.apid.core.notifications.repository.NotificationRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;

@Service
public class NotificationService {

    private static final int DEFAULT_PAGE_SIZE = 20;
    private static final int MAX_PAGE_SIZE = 100;

    private final NotificationRepository notificationRepository;
    private final NotificationOutboxRepository outboxRepository;

    public NotificationService(
            NotificationRepository notificationRepository,
            NotificationOutboxRepository outboxRepository
    ) {
        this.notificationRepository = notificationRepository;
        this.outboxRepository = outboxRepository;
    }

    /**
     * Persists an in-app notification atomically inside the caller's transaction (zero silent drop).
     */
    @Transactional
    public NotificationDto notify(
            Long recipientUserId,
            NotificationModule module,
            String eventType,
            String title,
            String message,
            String deepLink
    ) {
        String safeDeepLink = DeepLinkValidator.validateAndNormalize(deepLink);

        Notification n = new Notification();
        n.setRecipientUserId(recipientUserId);
        n.setModule(module);
        n.setEventType(eventType);
        n.setTitle(title);
        n.setMessage(message);
        n.setDeepLink(safeDeepLink);
        n.setRead(false);

        Notification saved = notificationRepository.save(n);
        return NotificationDto.from(saved);
    }

    /**
     * Queues a notification event inside the PostgreSQL outbox inside the caller's transaction.
     * Useful when callers want retry-safe asynchronous materialization or future external delivery.
     */
    @Transactional
    public Long enqueueViaOutbox(
            Long recipientUserId,
            NotificationModule module,
            String eventType,
            String title,
            String message,
            String deepLink,
            NotificationChannel channel
    ) {
        String safeDeepLink = DeepLinkValidator.validateAndNormalize(deepLink);

        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("module", module.name());
        payload.put("eventType", eventType);
        payload.put("title", title);
        payload.put("message", message);
        if (safeDeepLink != null) {
            payload.put("deepLink", safeDeepLink);
        }

        NotificationOutbox outbox = new NotificationOutbox();
        outbox.setRecipientUserId(recipientUserId);
        outbox.setChannel(channel != null ? channel : NotificationChannel.IN_APP);
        outbox.setEventType(eventType);
        outbox.setPayloadJson(payload);
        outbox.setStatus(NotificationOutboxStatus.PENDING);
        outbox.setAttemptCount(0);
        outbox.setNextAttemptAt(Instant.now());

        return outboxRepository.save(outbox).getId();
    }

    @Transactional(readOnly = true)
    public NotificationPageDto listMyNotifications(Long userId, int page, int size, boolean unreadOnly) {
        int safePage = Math.max(page, 0);
        int safeSize = size <= 0 ? DEFAULT_PAGE_SIZE : Math.min(size, MAX_PAGE_SIZE);
        PageRequest pageable = PageRequest.of(safePage, safeSize);

        Page<Notification> result = unreadOnly
                ? notificationRepository.findByRecipientUserIdAndReadFalseOrderByCreatedAtDescIdDesc(userId, pageable)
                : notificationRepository.findByRecipientUserIdOrderByCreatedAtDescIdDesc(userId, pageable);

        long unreadCount = notificationRepository.countByRecipientUserIdAndReadFalse(userId);

        return new NotificationPageDto(
                result.getContent().stream().map(NotificationDto::from).toList(),
                result.getNumber(),
                result.getSize(),
                result.getTotalElements(),
                result.getTotalPages(),
                unreadCount
        );
    }

    /**
     * Scoped lookup returning 404 when missing OR belonging to a different user (prevents IDOR probing).
     * Idempotent when called repeatedly on an already-read notification.
     */
    @Transactional
    public NotificationDto markRead(Long notificationId, Long userId) {
        Notification notification = notificationRepository.findByIdAndRecipientUserId(notificationId, userId)
                .orElseThrow(() -> new ResourceNotFoundException("Notification not found"));

        if (!notification.isRead()) {
            notification.setRead(true);
            notification.setReadAt(Instant.now());
            notification = notificationRepository.save(notification);
        }
        return NotificationDto.from(notification);
    }

    @Transactional
    public MarkAllReadResultDto markAllRead(Long userId) {
        int updated = notificationRepository.markAllReadForUser(userId, Instant.now());
        return new MarkAllReadResultDto(updated);
    }
}

