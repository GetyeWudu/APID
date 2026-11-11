package com.boa.apid.core.authorization.service;

import com.boa.apid.core.authorization.repository.UserRoleRepository;
import org.springframework.cache.Cache;
import org.springframework.cache.CacheManager;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

import java.util.ArrayList;

/**
 * Backing Redis cache store and post-commit cache evictor for user_permissions.
 */
@Component
public class PermissionCacheStore {

    public static final String CACHE_NAME = "user_permissions";

    private final UserRoleRepository userRoleRepository;
    private final CacheManager cacheManager;

    public PermissionCacheStore(UserRoleRepository userRoleRepository, CacheManager cacheManager) {
        this.userRoleRepository = userRoleRepository;
        this.cacheManager = cacheManager;
    }

    @Cacheable(value = CACHE_NAME, key = "#userId")
    @Transactional(readOnly = true)
    public ArrayList<String> loadPermissionCodes(Long userId) {
        return new ArrayList<>(userRoleRepository.findActivePermissionCodesByUserId(userId));
    }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT, fallbackExecution = true)
    public void onPermissionChange(PermissionCacheInvalidationEvent event) {
        Cache cache = cacheManager.getCache(CACHE_NAME);
        if (cache == null) {
            return;
        }
        if (event.evictAll()) {
            cache.clear();
        } else if (event.userId() != null) {
            cache.evict(event.userId());
        }
    }
}

