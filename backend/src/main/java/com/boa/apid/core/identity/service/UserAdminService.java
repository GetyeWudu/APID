package com.boa.apid.core.identity.service;

import com.boa.apid.common.exception.BusinessException;
import com.boa.apid.common.exception.ResourceNotFoundException;
import com.boa.apid.core.audit.service.AuditService;
import com.boa.apid.core.auth.security.ApidUserPrincipal;
import com.boa.apid.core.auth.service.RefreshTokenService;
import com.boa.apid.core.authorization.entity.*;
import com.boa.apid.core.authorization.repository.RoleRepository;
import com.boa.apid.core.authorization.repository.UserRepository;
import com.boa.apid.core.authorization.repository.UserRoleRepository;
import com.boa.apid.core.authorization.service.PermissionCacheInvalidationEvent;
import com.boa.apid.core.authorization.service.SuperAdminProtectionService;
import com.boa.apid.core.identity.dto.*;
import jakarta.persistence.criteria.Predicate;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.time.Instant;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class UserAdminService {

    private static final int MAX_PAGE_SIZE = 100;
    private static final Set<String> ALLOWED_SORT_FIELDS = Set.of("id", "username", "status", "createdAt", "lastLoginAt");
    private static final String TEMP_PASS_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%";
    private static final SecureRandom SECURE_RANDOM = new SecureRandom();

    private final UserRepository userRepository;
    private final RoleRepository roleRepository;
    private final UserRoleRepository userRoleRepository;
    private final PasswordEncoder passwordEncoder;
    private final RefreshTokenService refreshTokenService;
    private final SuperAdminProtectionService protectionService;
    private final ApplicationEventPublisher eventPublisher;
    private final AuditService auditService;

    public UserAdminService(
            UserRepository userRepository,
            RoleRepository roleRepository,
            UserRoleRepository userRoleRepository,
            PasswordEncoder passwordEncoder,
            RefreshTokenService refreshTokenService,
            SuperAdminProtectionService protectionService,
            ApplicationEventPublisher eventPublisher,
            AuditService auditService
    ) {
        this.userRepository = userRepository;
        this.roleRepository = roleRepository;
        this.userRoleRepository = userRoleRepository;
        this.passwordEncoder = passwordEncoder;
        this.refreshTokenService = refreshTokenService;
        this.protectionService = protectionService;
        this.eventPublisher = eventPublisher;
        this.auditService = auditService;
    }

    @Transactional(readOnly = true)
    public Page<AdminUserDto> searchUsers(
            String search,
            UserStatus status,
            int page,
            int size,
            String sortBy,
            String sortDir
    ) {
        if (size < 1 || size > MAX_PAGE_SIZE) {
            throw new BusinessException("INVALID_PAGE_SIZE",
                    "Page size must be between 1 and " + MAX_PAGE_SIZE, HttpStatus.BAD_REQUEST);
        }
        if (!ALLOWED_SORT_FIELDS.contains(sortBy)) {
            throw new BusinessException("INVALID_SORT_FIELD",
                    "Unsupported sort field: " + sortBy, HttpStatus.BAD_REQUEST);
        }

        Sort.Direction direction = "asc".equalsIgnoreCase(sortDir) ? Sort.Direction.ASC : Sort.Direction.DESC;
        Sort sort = Sort.by(new Sort.Order(direction, sortBy), new Sort.Order(Sort.Direction.ASC, "id"));
        Pageable pageable = PageRequest.of(Math.max(page, 0), size, sort);

        Specification<User> spec = (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();
            if (search != null && !search.isBlank()) {
                predicates.add(cb.like(cb.lower(root.get("username")),
                        "%" + search.trim().toLowerCase(Locale.ROOT) + "%"));
            }
            if (status != null) {
                predicates.add(cb.equal(root.get("status"), status));
            }
            return cb.and(predicates.toArray(Predicate[]::new));
        };

        Page<User> usersPage = userRepository.findAll(spec, pageable);
        List<Long> userIds = usersPage.getContent().stream().map(User::getId).toList();
        Map<Long, Set<AdminUserDto.RoleSummary>> rolesByUserId = userIds.isEmpty()
                ? Map.of()
                : userRoleRepository.findActiveByUserIdsWithRole(userIds).stream()
                .collect(Collectors.groupingBy(
                        ur -> ur.getUser().getId(),
                        Collectors.mapping(
                                ur -> new AdminUserDto.RoleSummary(
                                        ur.getRole().getId(),
                                        ur.getRole().getName(),
                                        ur.getRole().isSystemProtected()
                                ),
                                Collectors.toCollection(() -> new TreeSet<>(
                                        Comparator.comparing(AdminUserDto.RoleSummary::name)))
                        )
                ));

        return usersPage.map(u -> toDto(u, rolesByUserId.getOrDefault(u.getId(), Set.of())));
    }

    @Transactional
    public CreateUserResponse createUser(CreateUserRequest req, ApidUserPrincipal actor) {
        String normalizedUsername = req.username().trim().toLowerCase(Locale.ROOT);
        if (userRepository.findByUsernameIgnoreCase(normalizedUsername).isPresent()) {
            throw new BusinessException("USERNAME_EXISTS",
                    "Username '" + normalizedUsername + "' already exists", HttpStatus.CONFLICT);
        }

        List<Role> roles = resolveAndCheckRoles(req.roleIds(), actor);
        String rawTempPassword = (req.temporaryPassword() != null && !req.temporaryPassword().isBlank())
                ? req.temporaryPassword()
                : generateSecureTempPassword();

        User actorRef = userRepository.getReferenceById(actor.getUserId());

        User user = new User();
        user.setUsername(normalizedUsername);
        user.setPasswordHash(passwordEncoder.encode(rawTempPassword));
        user.setAuthProvider(AuthProvider.LOCAL);
        user.setStatus(UserStatus.ACTIVE);
        user.setMustChangePassword(true);
        User savedUser = userRepository.save(user);

        Set<AdminUserDto.RoleSummary> summaries = new LinkedHashSet<>();
        for (Role role : roles) {
            UserRole ur = new UserRole();
            ur.setUser(savedUser);
            ur.setRole(role);
            ur.setAssignedBy(actorRef);
            ur.setActive(true);
            userRoleRepository.save(ur);
            summaries.add(new AdminUserDto.RoleSummary(role.getId(), role.getName(), role.isSystemProtected()));
        }

        auditService.record(new AuditService.AuditCommand(
                null, actor.getUserId(), actor.getUsername(), savedUser.getId(),
                "IAM", "USER_CREATED", "SUCCESS", null,
                "USER", String.valueOf(savedUser.getId()),
                Map.of("username", savedUser.getUsername(),
                        "roles", roles.stream().map(Role::getName).toList()),
                null, null
        ));

        return new CreateUserResponse(toDto(savedUser, summaries), rawTempPassword);
    }

    @Transactional
    public AdminUserDto updateStatus(Long targetUserId, UpdateUserStatusRequest req, ApidUserPrincipal actor) {
        if (targetUserId.equals(actor.getUserId()) && req.status() != UserStatus.ACTIVE) {
            throw new BusinessException("SELF_MODIFICATION_BLOCKED",
                    "You cannot disable or lock your own account", HttpStatus.BAD_REQUEST);
        }

        User user = userRepository.findById(targetUserId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));

        protectionService.assertSuperAdminRemainsAfterUserStatusChange(targetUserId, req.status());

        UserStatus oldStatus = user.getStatus();
        user.setStatus(req.status());

        if (req.status() != UserStatus.ACTIVE) {
            // Immediately revoke active access and refresh tokens
            user.setTokenVersion(user.getTokenVersion() + 1);
            refreshTokenService.revokeAllUserTokens(user.getId(), "ADMIN_STATUS_CHANGE");
        }
        User saved = userRepository.save(user);

        Map<String, Object> details = new LinkedHashMap<>();
        details.put("oldStatus", oldStatus.name());
        details.put("newStatus", req.status().name());
        if (req.reason() != null && !req.reason().isBlank()) {
            details.put("reason", req.reason().trim());
        }

        auditService.record(new AuditService.AuditCommand(
                null, actor.getUserId(), actor.getUsername(), saved.getId(),
                "IAM", "USER_STATUS_CHANGED", "SUCCESS", null,
                "USER", String.valueOf(saved.getId()),
                details, null, null
        ));

        return loadSingleDto(saved);
    }

    @Transactional
    public AdminUserDto unlockTemporaryLock(Long targetUserId, ApidUserPrincipal actor) {
        User user = userRepository.findById(targetUserId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));

        user.setFailedLoginAttempts(0);
        user.setFirstFailedLoginAt(null);
        user.setLockedUntil(null);
        User saved = userRepository.save(user);

        auditService.record(new AuditService.AuditCommand(
                null, actor.getUserId(), actor.getUsername(), saved.getId(),
                "IAM", "USER_UNLOCKED", "SUCCESS", null,
                "USER", String.valueOf(saved.getId()),
                Map.of("status", saved.getStatus().name()), null, null
        ));

        return loadSingleDto(saved);
    }

    @Transactional
    public PasswordResetResponse resetPassword(Long targetUserId, ApidUserPrincipal actor) {
        User user = userRepository.findById(targetUserId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));

        String rawTempPassword = generateSecureTempPassword();
        user.setPasswordHash(passwordEncoder.encode(rawTempPassword));
        user.setMustChangePassword(true);
        user.setTokenVersion(user.getTokenVersion() + 1);
        user.setFailedLoginAttempts(0);
        user.setFirstFailedLoginAt(null);
        user.setLockedUntil(null);
        userRepository.save(user);

        refreshTokenService.revokeAllUserTokens(user.getId(), "ADMIN_PASSWORD_RESET");

        auditService.record(new AuditService.AuditCommand(
                null, actor.getUserId(), actor.getUsername(), user.getId(),
                "IAM", "USER_PASSWORD_RESET", "SUCCESS", null,
                "USER", String.valueOf(user.getId()),
                Map.of("mustChangePassword", true), null, null
        ));

        return new PasswordResetResponse(user.getId(), user.getUsername(), rawTempPassword);
    }

    @Transactional
    public AdminUserDto updateUserRoles(Long targetUserId, UpdateUserRolesRequest req, ApidUserPrincipal actor) {
        User user = userRepository.findById(targetUserId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));

        List<Role> targetRoles = resolveAndCheckRoles(req.roleIds(), actor);
        Set<String> targetRoleNames = targetRoles.stream().map(Role::getName).collect(Collectors.toSet());

        protectionService.assertSuperAdminRemainsAfterRoleUpdate(targetUserId, targetRoleNames);

        List<UserRole> currentActive = userRoleRepository.findActiveByUserIdWithRole(targetUserId);
        Set<Long> currentRoleIds = currentActive.stream().map(ur -> ur.getRole().getId()).collect(Collectors.toSet());
        Set<Long> requestedRoleIds = targetRoles.stream().map(Role::getId).collect(Collectors.toSet());

        User actorRef = userRepository.getReferenceById(actor.getUserId());
        Instant now = Instant.now();

        // Mark removed roles inactive to preserve historical audit trail
        for (UserRole ur : currentActive) {
            if (!requestedRoleIds.contains(ur.getRole().getId())) {
                ur.setActive(false);
                ur.setRevokedBy(actorRef);
                ur.setRevokedAt(now);
                userRoleRepository.save(ur);
            }
        }

        // Insert new active assignments
        for (Role role : targetRoles) {
            if (!currentRoleIds.contains(role.getId())) {
                UserRole ur = new UserRole();
                ur.setUser(user);
                ur.setRole(role);
                ur.setAssignedBy(actorRef);
                ur.setActive(true);
                userRoleRepository.save(ur);
            }
        }

        // Post-commit Redis permission cache eviction
        eventPublisher.publishEvent(PermissionCacheInvalidationEvent.forUser(targetUserId));

        auditService.record(new AuditService.AuditCommand(
                null, actor.getUserId(), actor.getUsername(), targetUserId,
                "IAM", "USER_ROLES_UPDATED", "SUCCESS", null,
                "USER", String.valueOf(targetUserId),
                Map.of("newRoles", targetRoleNames), null, null
        ));

        return loadSingleDto(user);
    }

    private List<Role> resolveAndCheckRoles(Set<Long> roleIds, ApidUserPrincipal actor) {
        List<Role> roles = roleRepository.findAllById(roleIds);
        if (roles.size() != roleIds.size()) {
            throw new BusinessException("INVALID_ROLE", "One or more role IDs do not exist", HttpStatus.BAD_REQUEST);
        }
        boolean actorIsSuperAdmin = actor.getRoles().contains("Super Admin");
        for (Role role : roles) {
            if (!role.isActive()) {
                throw new BusinessException("INACTIVE_ROLE",
                        "Cannot assign inactive role: " + role.getName(), HttpStatus.BAD_REQUEST);
            }
            if (!actorIsSuperAdmin) {
                if (role.isSystemProtected()) {
                    throw new BusinessException("PRIVILEGE_ESCALATION_DENIED",
                            "Only Super Admin can assign system-protected roles", HttpStatus.FORBIDDEN);
                }
                Set<String> rolePermCodes = role.getPermissions().stream()
                        .map(Permission::getCode).collect(Collectors.toSet());
                if (!actor.getPermissions().containsAll(rolePermCodes)) {
                    throw new BusinessException("PRIVILEGE_ESCALATION_DENIED",
                            "Cannot assign role containing permissions you do not hold", HttpStatus.FORBIDDEN);
                }
            }
        }
        return roles;
    }

    private AdminUserDto loadSingleDto(User user) {
        Set<AdminUserDto.RoleSummary> summaries = userRoleRepository.findActiveByUserIdWithRole(user.getId())
                .stream()
                .map(ur -> new AdminUserDto.RoleSummary(
                        ur.getRole().getId(), ur.getRole().getName(), ur.getRole().isSystemProtected()))
                .collect(Collectors.toCollection(() -> new TreeSet<>(
                        Comparator.comparing(AdminUserDto.RoleSummary::name))));
        return toDto(user, summaries);
    }

    private AdminUserDto toDto(User user, Set<AdminUserDto.RoleSummary> roles) {
        boolean tempLocked = user.getLockedUntil() != null && user.getLockedUntil().isAfter(Instant.now());
        return new AdminUserDto(
                user.getId(),
                user.getUsername(),
                user.getAuthProvider(),
                user.getStatus(),
                tempLocked,
                user.getLockedUntil(),
                user.getFailedLoginAttempts(),
                user.isMustChangePassword(),
                roles,
                user.getLastLoginAt(),
                user.getCreatedAt()
        );
    }

    private String generateSecureTempPassword() {
        StringBuilder sb = new StringBuilder(14);
        for (int i = 0; i < 14; i++) {
            sb.append(TEMP_PASS_CHARS.charAt(SECURE_RANDOM.nextInt(TEMP_PASS_CHARS.length())));
        }
        return sb.toString();
    }
}

