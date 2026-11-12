package com.boa.apid.core.config.service;

import com.boa.apid.common.exception.ResourceNotFoundException;
import com.boa.apid.core.config.dto.ActiveCycleDto;
import com.boa.apid.core.config.dto.PublicConfigDto;
import com.boa.apid.core.config.entity.FiscalQuarter;
import com.boa.apid.core.config.entity.SystemConfig;
import com.boa.apid.core.config.repository.FiscalQuarterRepository;
import com.boa.apid.core.config.repository.SystemConfigRepository;
import org.springframework.cache.Cache;
import org.springframework.cache.CacheManager;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

import java.util.Map;
import java.util.stream.Collectors;

/**
 * Redis cache boundary for Fiscal Quarters & Public Config allowlist DTOs.
 * Eviction executes strictly AFTER_COMMIT so concurrent readers cannot repopulate stale data.
 */
@Component
public class ConfigCacheStore {

    private final FiscalQuarterRepository fiscalQuarterRepository;
    private final SystemConfigRepository systemConfigRepository;
    private final CacheManager cacheManager;

    public ConfigCacheStore(
            FiscalQuarterRepository fiscalQuarterRepository,
            SystemConfigRepository systemConfigRepository,
            CacheManager cacheManager
    ) {
        this.fiscalQuarterRepository = fiscalQuarterRepository;
        this.systemConfigRepository = systemConfigRepository;
        this.cacheManager = cacheManager;
    }

    @Cacheable(cacheNames = "fiscal_quarters", key = "'active_cycle'")
    public ActiveCycleDto getActiveCycleCached() {
        FiscalQuarter active = fiscalQuarterRepository.findByActiveTrue()
                .orElseThrow(() -> new ResourceNotFoundException("No active fiscal quarter is configured"));
        return ActiveCycleDto.from(active);
    }

    @Cacheable(cacheNames = "system_configs", key = "'public'")
    public PublicConfigDto getPublicConfigCached() {
        Map<String, String> pub = systemConfigRepository.findAllByPublicVisibleTrueOrderByConfigKeyAsc()
                .stream()
                .collect(Collectors.toMap(SystemConfig::getConfigKey, SystemConfig::getConfigValue));

        return new PublicConfigDto(
                parseIntOrDefault(pub.get("coaching.mandatory_cutoff_rounded"), 3),
                parseIntOrDefault(pub.get("coaching.missed_session_alert_threshold"), 2),
                parseIntOrDefault(pub.get("coaching.inactivity_reminder_days"), 14),
                parseIntOrDefault(pub.get("files.max_upload_mb"), 25)
        );
    }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT, fallbackExecution = true)
    public void onConfigChanged(ConfigCacheInvalidationEvent event) {
        if (event.evictQuarters()) {
            Cache qCache = cacheManager.getCache("fiscal_quarters");
            if (qCache != null) qCache.clear();
        }
        if (event.evictConfigs()) {
            Cache cCache = cacheManager.getCache("system_configs");
            if (cCache != null) cCache.clear();
        }
    }

    private int parseIntOrDefault(String raw, int fallback) {
        if (raw == null || raw.isBlank()) return fallback;
        try {
            return Integer.parseInt(raw.trim());
        } catch (NumberFormatException ignored) {
            return fallback;
        }
    }
}

