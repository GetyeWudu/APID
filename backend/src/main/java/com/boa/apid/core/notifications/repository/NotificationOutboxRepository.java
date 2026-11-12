package com.boa.apid.core.notifications.repository;

import com.boa.apid.core.notifications.entity.NotificationOutbox;
import com.boa.apid.core.notifications.entity.NotificationOutboxStatus;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.Instant;
import java.util.List;

public interface NotificationOutboxRepository extends JpaRepository<NotificationOutbox, Long> {

    List<NotificationOutbox> findTop50ByStatusAndNextAttemptAtLessThanEqualOrderByCreatedAtAsc(
            NotificationOutboxStatus status,
            Instant cutoff
    );
}

