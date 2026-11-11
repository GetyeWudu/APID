package com.boa.apid.core.authorization.service;

import com.boa.apid.core.authorization.repository.UserRoleRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.LinkedHashSet;
import java.util.Set;

/**
 * Resolves live active roles and Redis-cached granular permission codes for a user.
 */
@Service
public class UserAuthorityService {

    private final UserRoleRepository userRoleRepository;
    private final PermissionCacheStore permissionCacheStore;

    public UserAuthorityService(
            UserRoleRepository userRoleRepository,
            PermissionCacheStore permissionCacheStore
    ) {
        this.userRoleRepository = userRoleRepository;
        this.permissionCacheStore = permissionCacheStore;
    }

    @Transactional(readOnly = true)
    public Set<String> getActiveRoles(Long userId) {
        return new LinkedHashSet<>(userRoleRepository.findActiveRoleNamesByUserId(userId));
    }

    public Set<String> getActivePermissions(Long userId) {
        return new LinkedHashSet<>(permissionCacheStore.loadPermissionCodes(userId));
    }
}
