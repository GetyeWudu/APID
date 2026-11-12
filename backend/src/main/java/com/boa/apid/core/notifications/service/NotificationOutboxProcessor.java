package com.boa.apid.core.notifications.service;

import com.boa.apid.core.notifications.entity.*;
import com.boa.apid.core.notifications.repository.NotificationOutboxRepository;
import com.boa.apid.core.notifications.repository.NotificationRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Map;

@Component
public class NotificationOutboxProcessor {

    private static final Logger log = LoggerFactory.getLogger(NotificationOutboxProcessor.class);
    private static final int MAX_ATTEMPTS = 5;

    private final NotificationOutboxRepository outboxRepository;
    private final NotificationRepository notificationRepository;
    private final List<NotificationChannelSender> externalSenders;

    public NotificationOutboxProcessor(
            NotificationOutboxRepository outboxRepository,
            NotificationRepository notificationRepository,
            List<NotificationChannelSender> externalSenders
    ) {
        this.outboxRepository = outboxRepository;
        this.notificationRepository = notificationRepository;
        this.externalSenders = externalSenders != null ? externalSenders : List.of();
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void processSingle(Long outboxId) {
        NotificationOutbox entry = outboxRepository.findById(outboxId).orElse(null);
        if (entry == null || entry.getStatus() != NotificationOutboxStatus.PENDING) {
            return;
        }

        try {
            if (entry.getChannel() == NotificationChannel.IN_APP) {
                if (entry.getNotificationId() == null) {
                    Notification created = materializeInApp(entry);
                    entry.setNotificationId(created.getId());
                }
            } else {
                for (NotificationChannelSender sender : externalSenders) {
                    if (sender.supports(entry.getChannel())) {
                        sender.dispatch(entry);
                    }
                }
            }

            entry.setStatus(NotificationOutboxStatus.PROCESSED);
            entry.setProcessedAt(Instant.now());
            entry.setLastError(null);
            outboxRepository.save(entry);
        } catch (Exception ex) {
            int nextAttempts = entry.getAttemptCount() + 1;
            entry.setAttemptCount(nextAttempts);
            String msg = ex.getMessage() != null ? ex.getMessage() : ex.getClass().getSimpleName();
            entry.setLastError(msg.length() > 500 ? msg.substring(0, 500) : msg);

            if (nextAttempts >= MAX_ATTEMPTS) {
                entry.setStatus(NotificationOutboxStatus.FAILED);
                log.error("Notification outbox {} reached max attempts ({}): {}", outboxId, MAX_ATTEMPTS, msg);
            } else {
                long backoffSeconds = (long) Math.pow(2, nextAttempts) * 15L;
                entry.setNextAttemptAt(Instant.now().plus(backoffSeconds, ChronoUnit.SECONDS));
                log.warn("Notification outbox {} retry {} scheduled: {}", outboxId, nextAttempts, msg);
            }
            outboxRepository.save(entry);
        }
    }

    private Notification materializeInApp(NotificationOutbox entry) {
        Map<String, Object> payload = entry.getPayloadJson();
        NotificationModule module = NotificationModule.valueOf(String.valueOf(payload.get("module")));
        String title = String.valueOf(payload.get("title"));
        String message = String.valueOf(payload.get("message"));
        Object rawDeepLink = payload.get("deepLink");
        String safeDeepLink = rawDeepLink != null
                ? DeepLinkValidator.validateAndNormalize(String.valueOf(rawDeepLink))
                : null;

        Notification n = new Notification();
        n.setRecipientUserId(entry.getRecipientUserId());
        n.setModule(module);
        n.setEventType(entry.getEventType());
        n.setTitle(title);
        n.setMessage(message);
        n.setDeepLink(safeDeepLink);
        n.setRead(false);
        return notificationRepository.save(n);
    }
}

