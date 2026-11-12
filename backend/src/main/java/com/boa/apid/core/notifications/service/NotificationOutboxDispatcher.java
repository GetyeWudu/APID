package com.boa.apid.core.notifications.service;

import com.boa.apid.core.notifications.entity.NotificationOutbox;
import com.boa.apid.core.notifications.entity.NotificationOutboxStatus;
import com.boa.apid.core.notifications.repository.NotificationOutboxRepository;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.List;

@Component
public class NotificationOutboxDispatcher {

    private final NotificationOutboxRepository outboxRepository;
    private final NotificationOutboxProcessor processor;

    public NotificationOutboxDispatcher(
            NotificationOutboxRepository outboxRepository,
            NotificationOutboxProcessor processor
    ) {
        this.outboxRepository = outboxRepository;
        this.processor = processor;
    }

    @Scheduled(fixedDelayString = "${apid.notifications.outbox-delay-ms:15000}")
    public void dispatchPending() {
        List<NotificationOutbox> batch = outboxRepository
                .findTop50ByStatusAndNextAttemptAtLessThanEqualOrderByCreatedAtAsc(
                        NotificationOutboxStatus.PENDING,
                        Instant.now()
                );
        for (NotificationOutbox entry : batch) {
            processor.processSingle(entry.getId());
        }
    }
}

