package com.boa.apid.core.auth.service;

import com.boa.apid.core.auth.config.LdapProperties;
import com.boa.apid.core.config.entity.SystemConfig;
import com.boa.apid.core.config.repository.SystemConfigRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.time.Instant;
import java.util.Locale;
import java.util.concurrent.atomic.AtomicBoolean;

/**
 * Background scheduler that triggers automated Active Directory synchronization.
 *
 * Runs automatically:
 * 1. Shortly after application startup (ApplicationReadyEvent).
 * 2. On a dynamic interval configured in Admin Coaching Rules & Policies:
 *    - 7_DAYS (7 days - governance default)
 *    - 1_DAY (24 hours)
 *    - 12_HOURS (12 hours)
 *    - 1_HOUR (1 hour)
 */
@Component
public class ActiveDirectorySyncScheduler {

    private static final Logger log = LoggerFactory.getLogger(ActiveDirectorySyncScheduler.class);

    private final LdapProperties ldapProperties;
    private final ActiveDirectorySyncService syncService;
    private final SystemConfigRepository systemConfigRepository;
    private final AtomicBoolean isSyncing = new AtomicBoolean(false);

    private volatile Instant lastSyncTime = null;

    public ActiveDirectorySyncScheduler(
            LdapProperties ldapProperties,
            ActiveDirectorySyncService syncService,
            SystemConfigRepository systemConfigRepository
    ) {
        this.ldapProperties = ldapProperties;
        this.syncService = syncService;
        this.systemConfigRepository = systemConfigRepository;
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
     * Dynamic periodic scheduled check evaluating whether the configured interval (default 7 days)
     * has elapsed. Replaces legacy hardcoded 30-minute cron with administrative policy governance.
     */
    @Scheduled(fixedDelay = 60_000, initialDelay = 60_000)
    public void evaluatePeriodicSync() {
        if (!ldapProperties.isEnabled() || !ldapProperties.isSyncEnabled()) {
            return;
        }

        Duration interval = resolveConfiguredInterval();
        Instant now = Instant.now();

        if (lastSyncTime == null) {
            // First tick if startup sync has not completed yet
            lastSyncTime = now;
            return;
        }

        Duration elapsed = Duration.between(lastSyncTime, now);
        if (elapsed.compareTo(interval) >= 0) {
            log.info("Active Directory scheduled sync cadence elapsed ({} >= configured {}). Executing background sync...",
                    elapsed, interval);
            triggerSync("Scheduled periodic interval (" + formatIntervalLabel(interval) + ")");
        }
    }

    /**
     * Manually or programmatically triggers sync with concurrency lock.
     */
    public ActiveDirectorySyncService.AdSyncResult triggerSync(String triggerSource) {
        if (!isSyncing.compareAndSet(false, true)) {
            log.warn("Active Directory sync already in progress. Skipping trigger from '{}'", triggerSource);
            return new ActiveDirectorySyncService.AdSyncResult(
                    false, "Sync already in progress", 0, 0, 0, 0, 0, 0, 0, Instant.now()
            );
        }

        try {
            log.info("Triggering Active Directory synchronization [Source: {}]", triggerSource);
            ActiveDirectorySyncService.AdSyncResult result = syncService.syncAll();
            this.lastSyncTime = Instant.now();
            return result;
        } finally {
            isSyncing.set(false);
        }
    }

    /**
     * Resolves the active sync interval from system_configs table.
     * Default: 7 days. Predefined options: 7_DAYS, 1_DAY, 12_HOURS, 1_HOUR.
     */
    public Duration resolveConfiguredInterval() {
        String raw = systemConfigRepository.findById("coaching.ad_sync_interval")
                .map(SystemConfig::getConfigValue)
                .orElse("7_DAYS")
                .trim()
                .toUpperCase(Locale.ROOT)
                .replace(" ", "_");

        return switch (raw) {
            case "1_HOUR", "HOUR", "HOURLY" -> Duration.ofHours(1);
            case "12_HOURS", "TWELVE_HOURS" -> Duration.ofHours(12);
            case "1_DAY", "DAY", "DAILY" -> Duration.ofDays(1);
            case "7_DAYS", "WEEK", "WEEKLY", "7_DAY" -> Duration.ofDays(7);
            default -> Duration.ofDays(7);
        };
    }

    public String resolveConfiguredIntervalLabel() {
        return formatIntervalLabel(resolveConfiguredInterval());
    }

    public Instant getLastSyncTime() {
        return lastSyncTime;
    }

    public Instant getNextScheduledSyncTime() {
        Instant base = (lastSyncTime != null) ? lastSyncTime : Instant.now();
        return base.plus(resolveConfiguredInterval());
    }

    private String formatIntervalLabel(Duration duration) {
        long hours = duration.toHours();
        if (hours >= 168) return "7 days";
        if (hours >= 24) return "1 day";
        if (hours >= 12) return "12 hours";
        if (hours >= 1) return "1 hour";
        return hours + " hours";
    }
}
