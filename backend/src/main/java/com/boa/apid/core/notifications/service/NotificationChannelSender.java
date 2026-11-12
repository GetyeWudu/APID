package com.boa.apid.core.notifications.service;

import com.boa.apid.core.notifications.entity.NotificationChannel;
import com.boa.apid.core.notifications.entity.NotificationOutbox;

/**
 * Optional SPI for dispatching outbox events to external channels (e.g. Phase 2 email/SMS).
 */
public interface NotificationChannelSender {
    boolean supports(NotificationChannel channel);

    void dispatch(NotificationOutbox outboxEntry);
}

