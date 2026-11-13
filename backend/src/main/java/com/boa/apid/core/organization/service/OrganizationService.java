package com.boa.apid.core.organization.service;

import com.boa.apid.common.exception.BusinessException;
import com.boa.apid.common.exception.ResourceNotFoundException;
import com.boa.apid.core.audit.entity.AuditLog;
import com.boa.apid.core.audit.repository.AuditLogRepository;
import com.boa.apid.core.audit.service.AuditService;
import com.boa.apid.core.auth.security.ApidUserPrincipal;
import com.boa.apid.core.authorization.entity.User;
import com.boa.apid.core.authorization.entity.UserStatus;
import com.boa.apid.core.authorization.repository.UserRepository;
import com.boa.apid.core.identity.dto.CreateUserRequest;
import com.boa.apid.core.identity.dto.CreateUserResponse;
import com.boa.apid.core.identity.service.UserAdminService;
import com.boa.apid.core.organization.dto.*;
import com.boa.apid.core.organization.entity.Department;
import com.boa.apid.core.organization.entity.Employee;
import com.boa.apid.core.organization.entity.EmploymentStatus;
import com.boa.apid.core.organization.event.EmployeeEmploymentStatusChangedEvent;
import com.boa.apid.core.organization.event.EmployeeManagerChangedEvent;
import com.boa.apid.core.organization.repository.DepartmentRepository;
import com.boa.apid.core.organization.repository.EmployeeRepository;
import jakarta.persistence.EntityManager;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.*;

@Service
public class OrganizationService {

    private static final String MODULE = "CORE_ORGANIZATION";

    private final DepartmentRepository departmentRepository;
    private final EmployeeRepository employeeRepository;
    private final UserRepository userRepository;
    private final DepartmentCacheStore departmentCacheStore;
    private final EmployeeQueryService employeeQueryService;
    private final ApplicationEventPublisher eventPublisher;
    private final AuditService auditService;
    private final EntityManager entityManager;
    private final UserAdminService userAdminService;
    private final AuditLogRepository auditLogRepository;

    public OrganizationService(
            DepartmentRepository departmentRepository,
            EmployeeRepository employeeRepository,
            UserRepository userRepository,
            DepartmentCacheStore departmentCacheStore,
            EmployeeQueryService employeeQueryService,
            ApplicationEventPublisher eventPublisher,
            AuditService auditService,
            EntityManager entityManager,
            UserAdminService userAdminService,
            AuditLogRepository auditLogRepository
    ) {
        this.departmentRepository = departmentRepository;
        this.employeeRepository = employeeRepository;
        this.userRepository = userRepository;
        this.departmentCacheStore = departmentCacheStore;
        this.employeeQueryService = employeeQueryService;
        this.eventPublisher = eventPublisher;
        this.auditService = auditService;
        this.entityManager = entityManager;
        this.userAdminService = userAdminService;
        this.auditLogRepository = auditLogRepository;
    }

    @Transactional(readOnly = true)
    public List<DepartmentDto> listDepartments(boolean activeOnly) {
        return activeOnly
                ? departmentCacheStore.getActiveDepartmentsCached()
                : departmentCacheStore.getAllDepartmentsCached();
    }

    @Transactional
    public DepartmentDto createDepartment(CreateDepartmentRequest request, ApidUserPrincipal actor) {
        acquireHierarchyAdvisoryLock();
        String code = normalizeBlank(request.code());
        String name = request.name().trim();

        if (code != null && departmentRepository.existsByCodeIgnoreCase(code)) {
            throw new BusinessException("DEPARTMENT_CODE_EXISTS", "Department code already exists", HttpStatus.CONFLICT);
        }

        Department parent = resolveParentDepartment(request.parentDepartmentId());
        assertDepartmentNameUnique(name, parent != null ? parent.getId() : null, null);
        String headName = resolveHeadEmployeeName(request.headEmployeeId());

        Department dept = new Department();
        dept.setCode(code);
        dept.setName(name);
        dept.setParentDepartment(parent);
        dept.setHeadEmployeeId(request.headEmployeeId());
        dept.setActive(true);

        Department saved = departmentRepository.save(dept);
        eventPublisher.publishEvent(new DepartmentCacheInvalidationEvent());

        auditService.record(new AuditService.AuditCommand(
                null,
                actor.getUserId(),
                actor.getUsername(),
                null,
                MODULE,
                "DEPARTMENT_CREATE",
                "SUCCESS",
                null,
                "DEPARTMENT",
                String.valueOf(saved.getId()),
                auditDetails("name", saved.getName(), "code", saved.getCode()),
                null,
                null
        ));

        return DepartmentDto.from(saved, headName);
    }

    @Transactional
    public DepartmentDto updateDepartment(Long id, UpdateDepartmentRequest request, ApidUserPrincipal actor) {
        acquireHierarchyAdvisoryLock();
        Department dept = departmentRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Department not found"));

        String code = normalizeBlank(request.code());
        String name = request.name().trim();

        if (code != null && departmentRepository.existsByCodeIgnoreCaseAndIdNot(code, id)) {
            throw new BusinessException("DEPARTMENT_CODE_EXISTS", "Department code already exists", HttpStatus.CONFLICT);
        }

        Department parent = resolveParentDepartment(request.parentDepartmentId());
        assertNoDepartmentCycle(id, parent != null ? parent.getId() : null);
        assertDepartmentNameUnique(name, parent != null ? parent.getId() : null, id);
        String headName = resolveHeadEmployeeName(request.headEmployeeId());

        dept.setCode(code);
        dept.setName(name);
        dept.setParentDepartment(parent);
        dept.setHeadEmployeeId(request.headEmployeeId());
        dept.setActive(Boolean.TRUE.equals(request.active()));

        Department saved = departmentRepository.save(dept);
        eventPublisher.publishEvent(new DepartmentCacheInvalidationEvent());

        auditService.record(new AuditService.AuditCommand(
                null,
                actor.getUserId(),
                actor.getUsername(),
                null,
                MODULE,
                "DEPARTMENT_UPDATE",
                "SUCCESS",
                null,
                "DEPARTMENT",
                String.valueOf(saved.getId()),
                auditDetails("name", saved.getName(), "active", saved.isActive()),
                null,
                null
        ));

        return DepartmentDto.from(saved, headName);
    }

    @Transactional
    public EmployeeDto createEmployee(CreateEmployeeRequest request, ApidUserPrincipal actor) {
        acquireHierarchyAdvisoryLock();
        String employeeNumber = request.employeeNumber().trim();
        String fullName = request.fullName().trim();
        String email = normalizeBlank(request.email());

        if (employeeRepository.existsByEmployeeNumberIgnoreCase(employeeNumber)) {
            throw new BusinessException("EMPLOYEE_NUMBER_EXISTS", "Employee number already exists", HttpStatus.CONFLICT);
        }
        if (email != null && employeeRepository.existsByEmailIgnoreCase(email)) {
            throw new BusinessException("EMPLOYEE_EMAIL_EXISTS", "Email address is already assigned to another employee", HttpStatus.CONFLICT);
        }
        validateUserLink(request.userId(), null);

        Department department = resolveDepartment(request.departmentId());
        Employee manager = resolveManager(request.managerId());

        Employee employee = new Employee();
        employee.setUserId(request.userId());
        employee.setEmployeeNumber(employeeNumber);
        employee.setFullName(fullName);
        employee.setEmail(email);
        employee.setGender(normalizeBlank(request.gender()));
        applyDepartment(employee, department);
        employee.setJob(normalizeBlank(request.job()));
        employee.setPosition(normalizeBlank(request.position()));
        employee.setManager(manager);
        employee.setEmploymentStatus(request.employmentStatus() != null ? request.employmentStatus() : EmploymentStatus.ACTIVE);

        Employee saved = employeeRepository.save(employee);

        auditService.record(new AuditService.AuditCommand(
                null,
                actor.getUserId(),
                actor.getUsername(),
                saved.getUserId(),
                MODULE,
                "EMPLOYEE_CREATE",
                "SUCCESS",
                null,
                "EMPLOYEE",
                String.valueOf(saved.getId()),
                auditDetails("employeeNumber", saved.getEmployeeNumber(), "fullName", saved.getFullName()),
                null,
                null
        ));

        return employeeQueryService.toDtoWithUsername(saved);
    }

    @Transactional
    public EmployeeDto updateEmployee(Long id, UpdateEmployeeRequest request, ApidUserPrincipal actor) {
        acquireHierarchyAdvisoryLock();
        Employee employee = employeeRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Employee not found"));

        String employeeNumber = request.employeeNumber().trim();
        String fullName = request.fullName().trim();
        String email = normalizeBlank(request.email());

        if (employeeRepository.existsByEmployeeNumberIgnoreCaseAndIdNot(employeeNumber, id)) {
            throw new BusinessException("EMPLOYEE_NUMBER_EXISTS", "Employee number already exists", HttpStatus.CONFLICT);
        }
        if (email != null && employeeRepository.existsByEmailIgnoreCaseAndIdNot(email, id)) {
            throw new BusinessException("EMPLOYEE_EMAIL_EXISTS", "Email address is already assigned to another employee", HttpStatus.CONFLICT);
        }
        if (request.userId() != null && !Objects.equals(request.userId(), employee.getUserId())) {
            validateUserLink(request.userId(), id);
        }

        Department department = resolveDepartment(request.departmentId());
        Employee manager = resolveManager(request.managerId());
        assertNoManagerCycle(id, manager != null ? manager.getId() : null);

        Long oldManagerId = employee.getManager() != null ? employee.getManager().getId() : null;
        Long newManagerId = manager != null ? manager.getId() : null;
        EmploymentStatus oldStatus = employee.getEmploymentStatus();
        EmploymentStatus newStatus = request.employmentStatus();

        if (request.userId() != null) {
            employee.setUserId(request.userId());
        }
        employee.setEmployeeNumber(employeeNumber);
        employee.setFullName(fullName);
        employee.setEmail(email);
        employee.setGender(normalizeBlank(request.gender()));
        applyDepartment(employee, department);
        employee.setJob(normalizeBlank(request.job()));
        employee.setPosition(normalizeBlank(request.position()));
        employee.setManager(manager);
        employee.setEmploymentStatus(newStatus);

        Employee saved = employeeRepository.save(employee);
        eventPublisher.publishEvent(new DepartmentCacheInvalidationEvent());

        Instant now = Instant.now();
        if (!Objects.equals(oldManagerId, newManagerId)) {
            eventPublisher.publishEvent(new EmployeeManagerChangedEvent(
                    saved.getId(), saved.getEmployeeNumber(), oldManagerId, newManagerId, "MANUAL_UPDATE", now
            ));
        }
        if (oldStatus != newStatus) {
            eventPublisher.publishEvent(new EmployeeEmploymentStatusChangedEvent(
                    saved.getId(), saved.getEmployeeNumber(), oldStatus, newStatus, "MANUAL_UPDATE", now
            ));
        }

        auditService.record(new AuditService.AuditCommand(
                null,
                actor.getUserId(),
                actor.getUsername(),
                saved.getUserId(),
                MODULE,
                "EMPLOYEE_UPDATE",
                "SUCCESS",
                null,
                "EMPLOYEE",
                String.valueOf(saved.getId()),
                auditDetails("employeeNumber", saved.getEmployeeNumber(), "status", saved.getEmploymentStatus().name()),
                null,
                null
        ));

        return employeeQueryService.toDtoWithUsername(saved);
    }

    @Transactional
    public EmployeeDto linkUser(Long employeeId, Long userId, ApidUserPrincipal actor) {
        acquireHierarchyAdvisoryLock();
        Employee employee = employeeRepository.findById(employeeId)
                .orElseThrow(() -> new ResourceNotFoundException("Employee not found"));
        validateUserLink(userId, employeeId);
        Long previousUserId = employee.getUserId();
        employee.setUserId(userId);
        Employee saved = employeeRepository.save(employee);

        auditService.record(new AuditService.AuditCommand(
                null,
                actor.getUserId(),
                actor.getUsername(),
                userId,
                MODULE,
                "EMPLOYEE_USER_LINKED",
                "SUCCESS",
                null,
                "EMPLOYEE",
                String.valueOf(saved.getId()),
                auditDetails("employeeNumber", saved.getEmployeeNumber(), "previousUserId", previousUserId),
                null,
                null
        ));

        return employeeQueryService.toDtoWithUsername(saved);
    }

    @Transactional
    public EmployeeDto unlinkUser(Long employeeId, ApidUserPrincipal actor) {
        acquireHierarchyAdvisoryLock();
        Employee employee = employeeRepository.findById(employeeId)
                .orElseThrow(() -> new ResourceNotFoundException("Employee not found"));
        Long previousUserId = employee.getUserId();
        employee.setUserId(null);
        Employee saved = employeeRepository.save(employee);

        auditService.record(new AuditService.AuditCommand(
                null,
                actor.getUserId(),
                actor.getUsername(),
                previousUserId,
                MODULE,
                "EMPLOYEE_USER_UNLINKED",
                "SUCCESS",
                null,
                "EMPLOYEE",
                String.valueOf(saved.getId()),
                auditDetails("employeeNumber", saved.getEmployeeNumber(), "previousUserId", previousUserId),
                null,
                null
        ));

        return employeeQueryService.toDtoWithUsername(saved);
    }

    @Transactional
    public CreateAndLinkEmployeeUserResponse createAndLinkUser(
            Long employeeId,
            CreateEmployeeUserRequest request,
            ApidUserPrincipal actor
    ) {
        acquireHierarchyAdvisoryLock();
        Employee employee = employeeRepository.findById(employeeId)
                .orElseThrow(() -> new ResourceNotFoundException("Employee not found"));
        if (employee.getUserId() != null) {
            throw new BusinessException(
                    "EMPLOYEE_ALREADY_LINKED",
                    "This employee already has a linked login account",
                    HttpStatus.CONFLICT
            );
        }

        String normalizedUsername = request.username().trim().toLowerCase(Locale.ROOT);
        Optional<User> existingAccount = userRepository.findByUsernameLowerForUpdate(normalizedUsername);
        String username;
        String temporaryPassword;
        Long userId;

        if (existingAccount.isPresent()) {
            User user = existingAccount.get();
            if (user.getStatus() != UserStatus.DISABLED
                    || employeeRepository.existsByUserId(user.getId())
                    || !wasRevokedFromEmployee(employee, user.getId())) {
                throw new BusinessException(
                        "USERNAME_EXISTS",
                        "Username '" + normalizedUsername + "' already exists",
                        HttpStatus.CONFLICT
                );
            }

            userAdminService.deleteUserAccountForEmployeeRevocation(
                    user.getId(),
                    actor,
                    "Replaced while recreating the employee login"
            );
        }

        CreateUserResponse created = userAdminService.createUser(
                new CreateUserRequest(normalizedUsername, null, request.roleIds()),
                actor
        );
        userId = created.user().id();
        username = created.user().username();
        temporaryPassword = created.temporaryPassword();

        validateUserLink(userId, employeeId);
        employee.setUserId(userId);
        Employee saved = employeeRepository.save(employee);

        auditService.record(new AuditService.AuditCommand(
                null,
                actor.getUserId(),
                actor.getUsername(),
                userId,
                MODULE,
                "EMPLOYEE_USER_LINKED",
                "SUCCESS",
                null,
                "EMPLOYEE",
                String.valueOf(saved.getId()),
                auditDetails("employeeNumber", saved.getEmployeeNumber(), "username", username),
                null,
                null
        ));

        return new CreateAndLinkEmployeeUserResponse(
                employeeQueryService.toDtoWithUsername(saved),
                username,
                temporaryPassword
        );
    }

    @Transactional
    public EmployeeDto revokeUserLink(Long employeeId, ApidUserPrincipal actor) {
        acquireHierarchyAdvisoryLock();
        Employee employee = employeeRepository.findById(employeeId)
                .orElseThrow(() -> new ResourceNotFoundException("Employee not found"));
        Long linkedUserId = employee.getUserId();
        if (linkedUserId == null) {
            throw new BusinessException(
                    "EMPLOYEE_NOT_LINKED",
                    "This employee does not have a linked login account",
                    HttpStatus.CONFLICT
            );
        }

        String linkedUsername = userAdminService.deleteUserAccountForEmployeeRevocation(
                linkedUserId,
                actor,
                "Employee login link revoked"
        );
        employee.setUserId(null);
        Employee saved = employeeRepository.save(employee);

        auditService.record(new AuditService.AuditCommand(
                null,
                actor.getUserId(),
                actor.getUsername(),
                null,
                MODULE,
                "EMPLOYEE_USER_LINK_REVOKED",
                "SUCCESS",
                null,
                "EMPLOYEE",
                String.valueOf(saved.getId()),
                Map.of(
                        "employeeNumber", saved.getEmployeeNumber(),
                        "userId", linkedUserId,
                        "username", linkedUsername
                ),
                null,
                null
        ));

        return employeeQueryService.toDtoWithUsername(saved);
    }

    @Transactional(readOnly = true)
    public List<UserAccountSummaryDto> listAvailableUsers(Long includeUserId, String search) {
        Set<Long> linkedUserIds = new HashSet<>(employeeRepository.findAllLinkedUserIds());
        String needle = normalizeBlank(search);
        String needleLower = needle == null ? null : needle.toLowerCase(Locale.ROOT);

        return userRepository.findAll(Sort.by(Sort.Direction.ASC, "username")).stream()
                .filter(u -> !linkedUserIds.contains(u.getId()) || Objects.equals(u.getId(), includeUserId))
                .filter(u -> needleLower == null || u.getUsername().toLowerCase(Locale.ROOT).contains(needleLower))
                .limit(100)
                .map(this::toUserSummary)
                .toList();
    }

    private Department resolveParentDepartment(Long parentDepartmentId) {
        if (parentDepartmentId == null) {
            return null;
        }
        return departmentRepository.findById(parentDepartmentId)
                .orElseThrow(() -> new ResourceNotFoundException("Parent department not found"));
    }

    private Department resolveDepartment(Long departmentId) {
        if (departmentId == null) {
            return null;
        }
        return departmentRepository.findById(departmentId)
                .orElseThrow(() -> new ResourceNotFoundException("Department not found"));
    }

    private Employee resolveManager(Long managerId) {
        if (managerId == null) {
            return null;
        }
        return employeeRepository.findById(managerId)
                .orElseThrow(() -> new ResourceNotFoundException("Manager employee not found"));
    }

    private String resolveHeadEmployeeName(Long headEmployeeId) {
        if (headEmployeeId == null) {
            return null;
        }
        return employeeRepository.findById(headEmployeeId)
                .map(Employee::getFullName)
                .orElseThrow(() -> new ResourceNotFoundException("Head employee not found"));
    }

    private void assertDepartmentNameUnique(String name, Long parentId, Long excludingId) {
        Optional<Department> existing = parentId == null
                ? departmentRepository.findRootByNameIgnoreCase(name)
                : departmentRepository.findChildByNameAndParentIdIgnoreCase(name, parentId);

        if (existing.isPresent() && !Objects.equals(existing.get().getId(), excludingId)) {
            throw new BusinessException(
                    "DEPARTMENT_ALREADY_EXISTS",
                    "A department with this name already exists under the same parent",
                    HttpStatus.CONFLICT
            );
        }
    }

    private void assertNoDepartmentCycle(Long departmentId, Long candidateParentId) {
        if (departmentId == null || candidateParentId == null) {
            return;
        }
        if (departmentId.equals(candidateParentId)) {
            throw new BusinessException("DEPARTMENT_CYCLE", "A department cannot be its own parent", HttpStatus.BAD_REQUEST);
        }

        Set<Long> visited = new HashSet<>();
        Long cursorId = candidateParentId;
        while (cursorId != null) {
            if (cursorId.equals(departmentId)) {
                throw new BusinessException(
                        "DEPARTMENT_CYCLE",
                        "Parent assignment creates a circular department hierarchy",
                        HttpStatus.BAD_REQUEST
                );
            }
            if (!visited.add(cursorId)) {
                break;
            }
            cursorId = departmentRepository.findById(cursorId)
                    .map(Department::getParentDepartment)
                    .map(Department::getId)
                    .orElse(null);
        }
    }

    private void assertNoManagerCycle(Long employeeId, Long candidateManagerId) {
        if (employeeId == null || candidateManagerId == null) {
            return;
        }
        if (employeeId.equals(candidateManagerId)) {
            throw new BusinessException("MANAGER_CYCLE", "An employee cannot report to themselves", HttpStatus.BAD_REQUEST);
        }

        Set<Long> visited = new HashSet<>();
        Long cursorId = candidateManagerId;
        while (cursorId != null) {
            if (cursorId.equals(employeeId)) {
                throw new BusinessException(
                        "MANAGER_CYCLE",
                        "Manager assignment creates a circular reporting hierarchy",
                        HttpStatus.BAD_REQUEST
                );
            }
            if (!visited.add(cursorId)) {
                break;
            }
            cursorId = employeeRepository.findById(cursorId)
                    .map(Employee::getManager)
                    .map(Employee::getId)
                    .orElse(null);
        }
    }

    private void validateUserLink(Long userId, Long excludingEmployeeId) {
        if (userId == null) {
            return;
        }
        if (!userRepository.existsById(userId)) {
            throw new ResourceNotFoundException("User account not found");
        }
        boolean alreadyLinked = excludingEmployeeId == null
                ? employeeRepository.existsByUserId(userId)
                : employeeRepository.existsByUserIdAndIdNot(userId, excludingEmployeeId);
        if (alreadyLinked) {
            throw new BusinessException(
                    "USER_ALREADY_LINKED",
                    "This user account is already linked to another employee",
                    HttpStatus.CONFLICT
            );
        }
    }

    private boolean wasRevokedFromEmployee(Employee employee, Long userId) {
        return auditLogRepository
                .findByEntityTypeAndEntityIdAndResultAndActionInOrderByCreatedAtDescIdDesc(
                        "EMPLOYEE",
                        String.valueOf(employee.getId()),
                        "SUCCESS",
                        List.of("EMPLOYEE_USER_LINKED", "EMPLOYEE_USER_LINK_REVOKED")
                )
                .stream()
                .filter(entry -> auditEntryTargetsUser(entry, userId))
                .findFirst()
                .map(AuditLog::getAction)
                .filter("EMPLOYEE_USER_LINK_REVOKED"::equals)
                .isPresent();
    }

    private boolean auditEntryTargetsUser(AuditLog entry, Long userId) {
        if (Objects.equals(entry.getTargetUserId(), userId)) {
            return true;
        }

        Object auditedUserId = entry.getDetailsJson() == null
                ? null
                : entry.getDetailsJson().get("userId");
        return auditedUserId instanceof Number number && number.longValue() == userId
                || auditedUserId instanceof String id && id.equals(userId.toString());
    }

    private void applyDepartment(Employee employee, Department department) {
        employee.setDepartment(department);
        if (department == null) {
            employee.setDepartmentName(null);
            employee.setParentDepartmentName(null);
            return;
        }
        employee.setDepartmentName(department.getName());
        employee.setParentDepartmentName(
                department.getParentDepartment() != null ? department.getParentDepartment().getName() : null
        );
    }

    private UserAccountSummaryDto toUserSummary(User user) {
        return new UserAccountSummaryDto(user.getId(), user.getUsername(), user.getStatus());
    }

    private Map<String, Object> auditDetails(String k1, Object v1, String k2, Object v2) {
        Map<String, Object> map = new LinkedHashMap<>();
        if (v1 != null) {
            map.put(k1, v1);
        }
        if (v2 != null) {
            map.put(k2, v2);
        }
        return map;
    }

    private void acquireHierarchyAdvisoryLock() {
        entityManager.createNativeQuery("SELECT pg_advisory_xact_lock(:key)")
                .setParameter("key", OrgImportService.ORG_HIERARCHY_ADVISORY_LOCK_KEY)
                .getSingleResult();
    }

    private String normalizeBlank(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }
}

