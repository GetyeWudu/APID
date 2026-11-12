package com.boa.apid.core.config.service;

public record ConfigCacheInvalidationEvent(boolean evictQuarters, boolean evictConfigs) {
    public static ConfigCacheInvalidationEvent both() {
        return new ConfigCacheInvalidationEvent(true, true);
    }

    public static ConfigCacheInvalidationEvent quartersOnly() {
        return new ConfigCacheInvalidationEvent(true, false);
    }

    public static ConfigCacheInvalidationEvent configsOnly() {
        return new ConfigCacheInvalidationEvent(false, true);
    }
}

