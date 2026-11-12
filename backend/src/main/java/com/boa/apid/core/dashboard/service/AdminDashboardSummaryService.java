package com.boa.apid.core.dashboard.service;

import com.boa.apid.core.audit.repository.AuditLogRepository;
import com.boa.apid.core.auth.security.ApidUserPrincipal;
import com.boa.apid.core.authorization.entity.UserStatus;
import com.boa.apid.core.authorization.repository.PermissionRepository;
import com.boa.apid.core.authorization.repository.UserRepository;
import com.boa.apid.core.authorization.service.RoleAdminService;
import com.boa.apid.core.dashboard.dto.AdminDashboardSummaryDto;
import com.boa.apid.core.dashboard.dto.AdminDashboardSummaryDto.*;
import com.boa.apid.core.organization.entity.EmploymentStatus;
import com.boa.apid.core.organization.repository.DepartmentRepository;
import com.boa.apid.core.organization.repository.EmployeeRepository;
import com.boa.apid.core.skills.repository.SkillRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Set;

/**
 * Computes System Admin dashboard KPIs on the backend without transferring full tables to the client.
 */
@Service
@Transactional(readOnly = true)
public class AdminDashboardSummaryService {

    private final UserRepository userRepository;
    private final EmployeeRepository employeeRepository;
    private final DepartmentRepository departmentRepository;
    private final SkillRepository skillRepository;
    private final AuditLogRepository auditLogRepository;
    private final RoleAdminService roleAdminService;
    private final PermissionRepository permissionRepository;

    public AdminDashboardSummaryService(
            UserRepository userRepository,
            EmployeeRepository employeeRepository,
            DepartmentRepository departmentRepository,
            SkillRepository skillRepository,
            AuditLogRepository auditLogRepository,
            RoleAdminService roleAdminService,
            PermissionRepository permissionRepository
    ) {
        this.userRepository = userRepository;
        this.employeeRepository = employeeRepository;
        this.departmentRepository = departmentRepository;
        this.skillRepository = skillRepository;
        this.auditLogRepository = auditLogRepository;
        this.roleAdminService = roleAdminService;
        this.permissionRepository = permissionRepository;
    }

    public AdminDashboardSummaryDto getSummary(ApidUserPrincipal actor) {
        Set<String> perms = actor != null ? actor.getPermissions() : Set.of();

        UserSummary users = perms.contains("USER_MANAGE") ? buildUserSummary() : null;

        EmployeeSummary employees = null;
        DepartmentSummary departments = null;
        if (perms.contains("HIERARCHY_MANAGE")) {
            employees = buildEmployeeSummary();
            departments = buildDepartmentSummary();
        }

        SkillSummary skills = perms.contains("SKILL_MANAGE") ? buildSkillSummary() : null;
        AuditSummary audit24h = perms.contains("AUDIT_LOG_VIEW") ? buildAuditSummary() : null;

        Integer totalPermissions = null;
        List<RoleCoverageItem> roles = null;
        if (perms.contains("ROLE_PERMISSION_MANAGE") || perms.contains("USER_MANAGE")) {
            totalPermissions = Math.toIntExact(permissionRepository.count());
            roles = roleAdminService.listAllRoles().stream()
                    .map(r -> new RoleCoverageItem(
                            r.id(),
                            r.name(),
                            r.systemProtected(),
                            r.active(),
                            r.permissions().size(),
                            r.activeUserCount()
                    ))
                    .toList();
        }

        return new AdminDashboardSummaryDto(
                users,
                employees,
                departments,
                skills,
                audit24h,
                totalPermissions,
                roles,
                false
        );
    }

    private UserSummary buildUserSummary() {
        long total = userRepository.count();
        long active = userRepository.countByStatus(UserStatus.ACTIVE);
        long temporarilyLocked = userRepository.countByLockedUntilAfter(Instant.now());
        long disabled = userRepository.countByStatus(UserStatus.DISABLED);
        long adminLocked = userRepository.countByStatus(UserStatus.ADMIN_LOCKED);
        long mustChangePassword = userRepository.countByMustChangePasswordTrue();
        return new UserSummary(total, active, temporarilyLocked, disabled, adminLocked, mustChangePassword);
    }

    private EmployeeSummary buildEmployeeSummary() {
        long total = employeeRepository.count();
        long active = employeeRepository.countByEmploymentStatus(EmploymentStatus.ACTIVE);
        long linked = employeeRepository.countByUserIdIsNotNull();
        long unlinked = Math.max(0L, total - linked);
        long managersLinked = employeeRepository.countByManagerIsNotNull();
        return new EmployeeSummary(total, active, linked, unlinked, managersLinked);
    }

    private DepartmentSummary buildDepartmentSummary() {
        long total = departmentRepository.count();
        long active = departmentRepository.countByActiveTrue();
        return new DepartmentSummary(total, active);
    }

    private SkillSummary buildSkillSummary() {
        long total = skillRepository.count();
        long active = skillRepository.countByActiveTrue();
        return new SkillSummary(total, active);
    }

    private AuditSummary buildAuditSummary() {
        Instant since = Instant.now().minus(24, ChronoUnit.HOURS);
        long total = auditLogRepository.countByCreatedAtAfter(since);
        long success = auditLogRepository.countByCreatedAtAfterAndResultIgnoreCase(since, "SUCCESS");
        long nonSuccess = Math.max(0L, total - success);
        return new AuditSummary(total, nonSuccess);
    }
}

