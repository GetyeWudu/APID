package com.boa.apid.core.authorization.service;

import com.boa.apid.common.exception.BusinessException;
import com.boa.apid.core.authorization.entity.Role;
import com.boa.apid.core.authorization.entity.UserStatus;
import com.boa.apid.core.authorization.repository.UserRepository;
import com.boa.apid.core.authorization.repository.UserRoleRepository;
import jakarta.persistence.EntityManager;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Set;

/**
 * Centralized, concurrency-safe safeguard preventing Super Admin lockout
 * across role mutations, permission removals, user disabling, and role unassignments.
 */
@Service
public class SuperAdminProtectionService {

    private static final long SUPER_ADMIN_LOCK_KEY = 90210002L;
    private static final Set<String> CRITICAL_GOVERNANCE_PERMISSIONS = Set.of(
            "USER_MANAGE",
            "ROLE_PERMISSION_MANAGE",
            "AUDIT_LOG_VIEW",
            "SYSTEM_CONFIG_MANAGE"
    );

    private final EntityManager entityManager;
    private final UserRepository userRepository;
    private final UserRoleRepository userRoleRepository;

    public SuperAdminProtectionService(
            EntityManager entityManager,
            UserRepository userRepository,
            UserRoleRepository userRoleRepository
    ) {
        this.entityManager = entityManager;
        this.userRepository = userRepository;
        this.userRoleRepository = userRoleRepository;
    }

    public void assertRoleUpdateAllowed(Role role, boolean newActive, String newName) {
        if (role.isSystemProtected()) {
            if (!newActive) {
                throw new BusinessException("PROTECTED_ROLE",
                        "System-protected role '" + role.getName() + "' cannot be deactivated",
                        HttpStatus.BAD_REQUEST);
            }
            if (newName != null && !role.getName().equalsIgnoreCase(newName.trim())) {
                throw new BusinessException("PROTECTED_ROLE",
                        "System-protected role '" + role.getName() + "' cannot be renamed",
                        HttpStatus.BAD_REQUEST);
            }
        }
    }

    public void assertProtectedPermissionsIntact(Role role, Set<String> newPermissionCodes) {
        if (role.isSystemProtected() && "Super Admin".equalsIgnoreCase(role.getName())) {
            for (String required : CRITICAL_GOVERNANCE_PERMISSIONS) {
                if (!newPermissionCodes.contains(required)) {
                    throw new BusinessException("PROTECTED_ROLE_PERMISSION",
                            "Cannot remove critical permission '" + required + "' from Super Admin",
                            HttpStatus.BAD_REQUEST);
                }
            }
        }
    }

    /**
     * Serializes Super Admin count checks using a PostgreSQL advisory lock
     * so two concurrent admin operations cannot both remove the last active Super Admin.
     */
    @Transactional
    public void assertSuperAdminRemainsAfterUserStatusChange(Long targetUserId, UserStatus newStatus) {
        if (newStatus == UserStatus.ACTIVE) {
            return;
        }
        acquireLock();
        boolean isSuperAdmin = userRoleRepository.findActiveRoleNamesByUserId(targetUserId)
                .stream()
                .anyMatch(name -> "Super Admin".equalsIgnoreCase(name));
        if (isSuperAdmin && userRepository.countActiveSuperAdmins() <= 1) {
            throw new BusinessException("LAST_SUPER_ADMIN_PROTECTED",
                    "Cannot disable or lock the last active Super Admin",
                    HttpStatus.BAD_REQUEST);
        }
    }

    @Transactional
    public void assertSuperAdminRemainsAfterRoleUpdate(Long targetUserId, Set<String> newRoleNames) {
        acquireLock();
        boolean currentlySuperAdmin = userRoleRepository.findActiveRoleNamesByUserId(targetUserId)
                .stream()
                .anyMatch(name -> "Super Admin".equalsIgnoreCase(name));
        boolean willRemainSuperAdmin = newRoleNames.stream()
                .anyMatch(name -> "Super Admin".equalsIgnoreCase(name));

        if (currentlySuperAdmin && !willRemainSuperAdmin && userRepository.countActiveSuperAdmins() <= 1) {
            throw new BusinessException("LAST_SUPER_ADMIN_PROTECTED",
                    "Cannot remove Super Admin role from the last active Super Admin",
                    HttpStatus.BAD_REQUEST);
        }
    }

    private void acquireLock() {
        entityManager.createNativeQuery("SELECT pg_advisory_xact_lock(:lockKey)")
                .setParameter("lockKey", SUPER_ADMIN_LOCK_KEY)
                .getSingleResult();
    }
}

