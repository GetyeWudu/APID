package com.boa.apid.core.authorization.service;

import com.boa.apid.common.exception.BusinessException;
import com.boa.apid.common.exception.ResourceNotFoundException;
import com.boa.apid.core.audit.service.AuditService;
import com.boa.apid.core.auth.security.ApidUserPrincipal;
import com.boa.apid.core.authorization.dto.*;
import com.boa.apid.core.authorization.entity.Permission;
import com.boa.apid.core.authorization.entity.Role;
import com.boa.apid.core.authorization.repository.PermissionRepository;
import com.boa.apid.core.authorization.repository.RoleRepository;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;
import java.util.stream.Collectors;

@Service
public class RoleAdminService {

    private final RoleRepository roleRepository;
    private final PermissionRepository permissionRepository;
    private final SuperAdminProtectionService protectionService;
    private final ApplicationEventPublisher eventPublisher;
    private final AuditService auditService;

    public RoleAdminService(
            RoleRepository roleRepository,
            PermissionRepository permissionRepository,
            SuperAdminProtectionService protectionService,
            ApplicationEventPublisher eventPublisher,
            AuditService auditService
    ) {
        this.roleRepository = roleRepository;
        this.permissionRepository = permissionRepository;
        this.protectionService = protectionService;
        this.eventPublisher = eventPublisher;
        this.auditService = auditService;
    }

    @Transactional(readOnly = true)
    public List<PermissionDto> listAllPermissions() {
        return permissionRepository.findAll(Sort.by(Sort.Order.asc("module"), Sort.Order.asc("code")))
                .stream()
                .map(p -> new PermissionDto(p.getId(), p.getCode(), p.getModule(), p.getDescription()))
                .toList();
    }

    @Transactional(readOnly = true)
    public List<RoleDto> listAllRoles() {
        return roleRepository.findAllWithPermissions()
                .stream()
                .map(this::toDto)
                .toList();
    }

    @Transactional
    public RoleDto createRole(CreateRoleRequest req, ApidUserPrincipal actor) {
        String trimmedName = req.name().trim();
        if (roleRepository.findByNameIgnoreCase(trimmedName).isPresent()) {
            throw new BusinessException("ROLE_ALREADY_EXISTS",
                    "Role '" + trimmedName + "' already exists", HttpStatus.CONFLICT);
        }

        assertNoPrivilegeEscalation(actor, req.permissionCodes());
        Set<Permission> permissions = resolvePermissions(req.permissionCodes());

        Role role = new Role();
        role.setName(trimmedName);
        role.setDescription(req.description() != null ? req.description().trim() : null);
        role.setSystemProtected(false);
        role.setActive(true);
        role.setPermissions(permissions);

        Role saved = roleRepository.save(role);

        auditService.record(new AuditService.AuditCommand(
                null, actor.getUserId(), actor.getUsername(), null,
                "IAM", "ROLE_CREATED", "SUCCESS", null,
                "ROLE", String.valueOf(saved.getId()),
                Map.of("roleName", saved.getName(), "permissions", req.permissionCodes()),
                null, null
        ));

        return toDto(saved);
    }

    @Transactional
    public RoleDto updateRole(Long id, UpdateRoleRequest req, ApidUserPrincipal actor) {
        Role role = roleRepository.findByIdWithPermissions(id)
                .orElseThrow(() -> new ResourceNotFoundException("Role not found"));

        String trimmedName = req.name().trim();
        protectionService.assertRoleUpdateAllowed(role, req.active(), trimmedName);

        if (roleRepository.existsByNameIgnoreCaseAndIdNot(trimmedName, id)) {
            throw new BusinessException("ROLE_ALREADY_EXISTS",
                    "Role '" + trimmedName + "' already exists", HttpStatus.CONFLICT);
        }

        boolean oldActive = role.isActive();
        String oldName = role.getName();

        role.setName(trimmedName);
        role.setDescription(req.description() != null ? req.description().trim() : null);
        role.setActive(req.active());

        Role saved = roleRepository.save(role);
        eventPublisher.publishEvent(PermissionCacheInvalidationEvent.forAllUsers());

        auditService.record(new AuditService.AuditCommand(
                null, actor.getUserId(), actor.getUsername(), null,
                "IAM", "ROLE_UPDATED", "SUCCESS", null,
                "ROLE", String.valueOf(saved.getId()),
                Map.of("oldName", oldName, "newName", saved.getName(), "oldActive", oldActive, "newActive", saved.isActive()),
                null, null
        ));

        return toDto(saved);
    }

    @Transactional
    public RoleDto updateRolePermissions(Long id, UpdateRolePermissionsRequest req, ApidUserPrincipal actor) {
        Role role = roleRepository.findByIdWithPermissions(id)
                .orElseThrow(() -> new ResourceNotFoundException("Role not found"));

        if (role.isSystemProtected() && !actor.getRoles().contains("Super Admin")) {
            throw new BusinessException("PROTECTED_ROLE",
                    "Only Super Admin may modify permissions on a protected role", HttpStatus.FORBIDDEN);
        }

        assertNoPrivilegeEscalation(actor, req.permissionCodes());
        protectionService.assertProtectedPermissionsIntact(role, req.permissionCodes());

        Set<String> oldCodes = role.getPermissions().stream().map(Permission::getCode).collect(Collectors.toSet());
        Set<Permission> nextPermissions = resolvePermissions(req.permissionCodes());

        role.setPermissions(nextPermissions);
        Role saved = roleRepository.save(role);

        // Evict Redis user_permissions ONLY after DB commit
        eventPublisher.publishEvent(PermissionCacheInvalidationEvent.forAllUsers());

        auditService.record(new AuditService.AuditCommand(
                null, actor.getUserId(), actor.getUsername(), null,
                "IAM", "ROLE_PERMISSIONS_UPDATED", "SUCCESS", null,
                "ROLE", String.valueOf(saved.getId()),
                Map.of("roleName", saved.getName(), "oldPermissions", oldCodes, "newPermissions", req.permissionCodes()),
                null, null
        ));

        return toDto(saved);
    }

    private void assertNoPrivilegeEscalation(ApidUserPrincipal actor, Set<String> targetPermissionCodes) {
        if (actor.getRoles().contains("Super Admin")) {
            return;
        }
        Set<String> actorPerms = actor.getPermissions();
        for (String code : targetPermissionCodes) {
            if (!actorPerms.contains(code)) {
                throw new BusinessException("PRIVILEGE_ESCALATION_DENIED",
                        "You are not authorized to delegate permission: " + code,
                        HttpStatus.FORBIDDEN);
            }
        }
    }

    private Set<Permission> resolvePermissions(Set<String> codes) {
        Set<Permission> result = new LinkedHashSet<>();
        for (String code : codes) {
            Permission p = permissionRepository.findByCode(code)
                    .orElseThrow(() -> new BusinessException("INVALID_PERMISSION",
                            "Unknown permission code: " + code, HttpStatus.BAD_REQUEST));
            result.add(p);
        }
        return result;
    }

    private RoleDto toDto(Role role) {
        Set<String> permCodes = role.getPermissions().stream()
                .map(Permission::getCode)
                .collect(Collectors.toCollection(TreeSet::new));
        long userCount = roleRepository.countActiveUsersByRoleId(role.getId());
        return new RoleDto(
                role.getId(),
                role.getName(),
                role.getDescription(),
                role.isSystemProtected(),
                role.isActive(),
                permCodes,
                userCount
        );
    }
}

