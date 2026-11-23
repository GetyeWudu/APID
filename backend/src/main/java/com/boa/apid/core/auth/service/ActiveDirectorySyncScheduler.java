package com.boa.apid.core.auth.service;

import com.boa.apid.core.auth.config.LdapProperties;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.util.concurrent.atomic.AtomicBoolean;

/**
 * Background scheduler that triggers automated Active Directory synchronization.
 *
 * Runs automatically:
 * 1. Shortly after application startup (ApplicationReadyEvent).
 * 2. On a recurring cron interval (every 30 minutes by default).
 */
@Component
public class ActiveDirectorySyncScheduler {

    private static final Logger log = LoggerFactory.getLogger(ActiveDirectorySyncScheduler.class);

    private final LdapProperties ldapProperties;
    private final ActiveDirectorySyncService syncService;
    private final AtomicBoolean isSyncing = new AtomicBoolean(false);

    public ActiveDirectorySyncScheduler(LdapProperties ldapProperties, ActiveDirectorySyncService syncService) {
        this.ldapProperties = ldapProperties;
        this.syncService = syncService;
    }

    /**
     * Initial synchronization shortly after application startup.
     */
    @EventListener(ApplicationReadyEvent.class)
    public void onApplicationReady() {
        if (!ldapProperties.isEnabled() || !ldapProperties.isSyncEnabled()) {
            log.info("Active Directory startup sync is disabled in configuration");
            return;
        }

        // Run in a background thread to prevent blocking startup
        Thread syncThread = new Thread(() -> {
            try {
                Thread.sleep(ldapProperties.getSyncInitialDelayMs());
                triggerSync("Startup initial reconciliation");
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
            }
        }, "ad-startup-sync");
        syncThread.setDaemon(true);
        syncThread.start();
    }

    /**
     * Periodic scheduled synchronization (every 30 minutes by default).
     */
    @Scheduled(cron = "${apid.ldap.sync-cron:0 */30 * * * *}")
    public void scheduledSync() {
        if (!ldapProperties.isEnabled() || !ldapProperties.isSyncEnabled()) {
            return;
        }
        triggerSync("Scheduled periodic interval (cron)");
    }

    /**
     * Manually or programmatically triggers sync with concurrency lock.
     */
    public ActiveDirectorySyncService.AdSyncResult triggerSync(String triggerSource) {
        if (!isSyncing.compareAndSet(false, true)) {
            log.warn("Active Directory sync already in progress. Skipping trigger from '{}'", triggerSource);
            return new ActiveDirectorySyncService.AdSyncResult(
                    false, "Sync already in progress", 0, 0, 0, 0, 0, 0, 0, java.time.Instant.now()
            );
        }

        try {
            log.info("Triggering Active Directory synchronization [Source: {}]", triggerSource);
            return syncService.syncAll();
        } finally {
            isSyncing.set(false);
        }
    }
}

