package com.boa.apid.core.auth.service;

import com.boa.apid.core.authorization.entity.AuthProvider;
import com.boa.apid.core.authorization.entity.Role;
import com.boa.apid.core.authorization.entity.User;
import com.boa.apid.core.authorization.entity.UserRole;
import com.boa.apid.core.authorization.entity.UserStatus;
import com.boa.apid.core.authorization.repository.RoleRepository;
import com.boa.apid.core.authorization.repository.UserRepository;
import com.boa.apid.core.authorization.repository.UserRoleRepository;
import jakarta.persistence.EntityManager;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.Locale;

/**
 * Concurrency-safe, idempotent bootstrapper for the initial Super Admin account.
 * Uses a PostgreSQL transaction advisory lock so concurrent container startups cannot race.
 */
@Component
public class AdminBootstrapRunner implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(AdminBootstrapRunner.class);
    private static final long ADVISORY_LOCK_KEY = 90210001L;

    private final EntityManager entityManager;
    private final UserRepository userRepository;
    private final RoleRepository roleRepository;
    private final UserRoleRepository userRoleRepository;
    private final PasswordEncoder passwordEncoder;
    private final String adminUsername;
    private final String adminPassword;

    public AdminBootstrapRunner(
            EntityManager entityManager,
            UserRepository userRepository,
            RoleRepository roleRepository,
            UserRoleRepository userRoleRepository,
            PasswordEncoder passwordEncoder,
            @Value("${apid.bootstrap.admin-username:admin}") String adminUsername,
            @Value("${apid.bootstrap.admin-password:}") String adminPassword
    ) {
        this.entityManager = entityManager;
        this.userRepository = userRepository;
        this.roleRepository = roleRepository;
        this.userRoleRepository = userRoleRepository;
        this.passwordEncoder = passwordEncoder;
        this.adminUsername = adminUsername;
        this.adminPassword = adminPassword;
    }

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        // Serialize across multiple simultaneous instances via PostgreSQL transaction advisory lock
        entityManager.createNativeQuery("SELECT pg_advisory_xact_lock(:lockKey)")
                .setParameter("lockKey", ADVISORY_LOCK_KEY)
                .getSingleResult();

        if (userRepository.countActiveSuperAdmins() > 0) {
            return;
        }

        if (adminPassword == null || adminPassword.isBlank()) {
            log.warn("No active Super Admin exists and APID_BOOTSTRAP_ADMIN_PASSWORD is not set. Skipping bootstrap.");
            return;
        }

        String normalizedUsername = adminUsername.trim().toLowerCase(Locale.ROOT);
        if (userRepository.findByUsernameIgnoreCase(normalizedUsername).isPresent()) {
            log.warn("Bootstrap username '{}' already exists; skipping Super Admin creation.", normalizedUsername);
            return;
        }

        Role superAdminRole = roleRepository.findByNameIgnoreCase("Super Admin")
                .orElseThrow(() -> new IllegalStateException("Super Admin role missing from Flyway seed"));

        User admin = new User();
        admin.setUsername(normalizedUsername);
        admin.setPasswordHash(passwordEncoder.encode(adminPassword));
        admin.setAuthProvider(AuthProvider.LOCAL);
        admin.setStatus(UserStatus.ACTIVE);
        admin.setMustChangePassword(true);
        User savedAdmin = userRepository.save(admin);

        UserRole userRole = new UserRole();
        userRole.setUser(savedAdmin);
        userRole.setRole(superAdminRole);
        userRole.setAssignedBy(null);
        userRole.setActive(true);
        userRoleRepository.save(userRole);

        log.info("Initial Super Admin account '{}' provisioned securely (must change password on first login).",
                normalizedUsername);
    }
}

