package com.boa.apid.core.auth.service;

import com.boa.apid.core.auth.config.LdapProperties;
import com.boa.apid.core.authorization.entity.*;
import com.boa.apid.core.authorization.repository.RoleRepository;
import com.boa.apid.core.authorization.repository.UserRepository;
import com.boa.apid.core.authorization.repository.UserRoleRepository;
import com.boa.apid.core.organization.entity.Department;
import com.boa.apid.core.organization.entity.Employee;
import com.boa.apid.core.organization.entity.EmploymentStatus;
import com.boa.apid.core.organization.repository.DepartmentRepository;
import com.boa.apid.core.organization.repository.EmployeeRepository;
import com.boa.apid.core.organization.service.DepartmentCacheInvalidationEvent;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.ldap.core.ContextMapper;
import org.springframework.ldap.core.DirContextAdapter;
import org.springframework.ldap.core.LdapTemplate;
import org.springframework.ldap.query.LdapQuery;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.*;
import java.util.stream.Collectors;

import static org.springframework.ldap.query.LdapQueryBuilder.query;

/**
 * Enterprise service responsible for automated and on-demand synchronization
 * between Windows Server Active Directory Domain Services (AD DS) and APID PostgreSQL database.
 *
 * Responsibilities:
 * 1. Synchronize user identity, employee metadata, and employment status.
 * 2. Reconcile reporting manager hierarchy from AD manager attributes.
 * 3. Map Active Directory Security Groups to APID Application Roles (RBAC).
 */
@Service
public class ActiveDirectorySyncService {

    private static final Logger log = LoggerFactory.getLogger(ActiveDirectorySyncService.class);

    private static final int UAC_ACCOUNTDISABLE = 0x0002;

    private static final Map<String, String> DEFAULT_GROUP_ROLE_MAPPINGS = Map.of(
            "APID-SUPER-ADMINS", "Super Admin",
            "Domain Admins", "Super Admin",
            "APID-PMS-DISTRICT-DIRECTORS", "District Director",
            "District-Directors", "District Director",
            "APID-PMS-BRANCH-MANAGERS", "Branch Manager",
            "Branch-Managers", "Branch Manager",
            "APID-PMS-OVERSIGHT", "HR Admin",
            "APID-ALL-EMPLOYEES", "Employee",
            "APID-PMS-EMPLOYEES", "Employee"
    );

    private final LdapProperties ldapProperties;
    private final LdapTemplate ldapTemplate;
    private final UserRepository userRepository;
    private final EmployeeRepository employeeRepository;
    private final DepartmentRepository departmentRepository;
    private final ApplicationEventPublisher eventPublisher;
    private final RoleRepository roleRepository;
    private final UserRoleRepository userRoleRepository;

    public ActiveDirectorySyncService(
            LdapProperties ldapProperties,
            LdapTemplate ldapTemplate,
            UserRepository userRepository,
            EmployeeRepository employeeRepository,
            DepartmentRepository departmentRepository,
            ApplicationEventPublisher eventPublisher,
            RoleRepository roleRepository,
            UserRoleRepository userRoleRepository
    ) {
        this.ldapProperties = ldapProperties;
        this.ldapTemplate = ldapTemplate;
        this.userRepository = userRepository;
        this.employeeRepository = employeeRepository;
        this.departmentRepository = departmentRepository;
        this.eventPublisher = eventPublisher;
        this.roleRepository = roleRepository;
        this.userRoleRepository = userRoleRepository;
    }

    /**
     * Executes full Active Directory synchronization.
     */
    @Transactional
    public AdSyncResult syncAll() {
        if (!ldapProperties.isEnabled()) {
            log.warn("Active Directory sync skipped: LDAP is disabled in configuration");
            return new AdSyncResult(false, "LDAP is disabled", 0, 0, 0, 0, 0, 0, 0, Instant.now());
        }

        long startMs = System.currentTimeMillis();
        log.info("Starting Active Directory periodic synchronization from {}", ldapProperties.getUrl());

        try {
            // Step 1: Scan all users from Active Directory
            List<AdSyncUserRecord> adUsers = fetchAllAdUsers();
            if (adUsers.isEmpty()) {
                log.warn("Active Directory sync found 0 users under search base {}", ldapProperties.getUserSearchBase());
                return new AdSyncResult(true, "No users found in AD search base", 0, 0, 0, 0, 0, 0,
                        System.currentTimeMillis() - startMs, Instant.now());
            }

            int usersScanned = adUsers.size();
            int usersCreated = 0;
            int usersUpdated = 0;
            int usersDisabled = 0;
            int managersLinked = 0;
            int rolesAssigned = 0;

            // Pre-load lookup caches to ensure high-performance in-memory reconciliation
            List<Department> departments = new ArrayList<>(departmentRepository.findAllByOrderByNameAsc());
            Map<String, Department> departmentCache = loadDepartmentCache(departments);
            Map<String, Department> departmentCodeCache = loadDepartmentCodeCache(departments);
            if (syncDepartmentsFromAd(adUsers, departments, departmentCache, departmentCodeCache)) {
                eventPublisher.publishEvent(new DepartmentCacheInvalidationEvent());
            }
            Map<String, Role> roleCache = loadRoleCache();

            // Index AD records by DN, sAMAccountName, and employeeID
            Map<String, AdSyncUserRecord> dnToAdUser = new HashMap<>();
            Map<String, AdSyncUserRecord> empIdToAdUser = new HashMap<>();
            for (AdSyncUserRecord u : adUsers) {
                if (u.distinguishedName() != null) {
                    dnToAdUser.put(u.distinguishedName().toLowerCase(Locale.ROOT), u);
                }
                if (u.employeeId() != null && !u.employeeId().isBlank()) {
                    empIdToAdUser.put(u.employeeId().trim(), u);
                }
            }

            // Map tracking created/updated DB employees for manager pass
            Map<String, Employee> employeeNumberToEntity = new HashMap<>();

            // -----------------------------------------------------------------
            // PASS 1: Identity & Profile Reconciliation (core.users & core.employees)
            // -----------------------------------------------------------------
            for (AdSyncUserRecord adUser : adUsers) {
                String samAccount = adUser.samAccountName();
                if (samAccount == null || samAccount.isBlank()) {
                    continue;
                }
                String normalizedUsername = samAccount.trim().toLowerCase(Locale.ROOT);
                String empNumber = (adUser.employeeId() != null && !adUser.employeeId().isBlank())
                        ? adUser.employeeId().trim()
                        : normalizedUsername;

                boolean isAdDisabled = (adUser.userAccountControl() & UAC_ACCOUNTDISABLE) != 0;

                // 1. Resolve or create User
                Optional<User> optUser = userRepository.findByUsernameLowerForUpdate(normalizedUsername);
                User user;
                boolean isNewUser = false;
                if (optUser.isPresent()) {
                    user = optUser.get();
                } else {
                    user = new User();
                    user.setUsername(normalizedUsername);
                    user.setAuthProvider(AuthProvider.ACTIVE_DIRECTORY);
                    isNewUser = true;
                    usersCreated++;
                }

                user.setExternalDirectoryId(empNumber);
                if (isAdDisabled) {
                    user.setStatus(UserStatus.DISABLED);
                    usersDisabled++;
                } else if (user.getStatus() == UserStatus.DISABLED) {
                    user.setStatus(UserStatus.ACTIVE);
                }
                user = userRepository.save(user);

                // 2. Resolve the employee's AD location to the generated department hierarchy.
                Department dept = resolveAdDepartment(adUser, departments, departmentCache, departmentCodeCache);

                // 3. Resolve or create Employee
                Optional<Employee> optEmp = employeeRepository.findByEmployeeNumberIgnoreCase(empNumber);
                Employee employee;
                if (optEmp.isPresent()) {
                    employee = optEmp.get();
                    if (!isNewUser) {
                        usersUpdated++;
                    }
                } else {
                    employee = new Employee();
                    employee.setEmployeeNumber(empNumber);
                }

                String resolvedFullName = resolveFullName(adUser, normalizedUsername);
                employee.setFullName(resolvedFullName);
                employee.setEmail(adUser.mail() != null && !adUser.mail().isBlank() ? adUser.mail().trim() : null);
                employee.setJob(adUser.title() != null && !adUser.title().isBlank() ? adUser.title().trim() : null);
                employee.setPosition(adUser.title() != null && !adUser.title().isBlank() ? adUser.title().trim() : null);
                if (dept != null) employee.setDepartment(dept);
                employee.setUserId(user.getId());
                employee.setEmploymentStatus(isAdDisabled ? EmploymentStatus.INACTIVE : EmploymentStatus.ACTIVE);

                employee = employeeRepository.save(employee);
                employeeNumberToEntity.put(empNumber, employee);

                // 4. Group to Role Mapping
                rolesAssigned += syncRolesForUserInternal(user, adUser.memberOfGroups(), roleCache);
            }

            // -----------------------------------------------------------------
            // PASS 2: Reporting Hierarchy Reconciliation (core.employees.manager_id)
            // -----------------------------------------------------------------
            for (AdSyncUserRecord adUser : adUsers) {
                String empNumber = (adUser.employeeId() != null && !adUser.employeeId().isBlank())
                        ? adUser.employeeId().trim()
                        : adUser.samAccountName().toLowerCase(Locale.ROOT);

                Employee employee = employeeNumberToEntity.get(empNumber);
                if (employee == null) continue;

                String managerDn = adUser.managerDn();
                if (managerDn != null && !managerDn.isBlank()) {
                    AdSyncUserRecord managerAdUser = dnToAdUser.get(managerDn.trim().toLowerCase(Locale.ROOT));
                    if (managerAdUser != null) {
                        String managerEmpNumber = (managerAdUser.employeeId() != null && !managerAdUser.employeeId().isBlank())
                                ? managerAdUser.employeeId().trim()
                                : managerAdUser.samAccountName().toLowerCase(Locale.ROOT);

                        Employee managerEmp = employeeNumberToEntity.get(managerEmpNumber);
                        if (managerEmp == null) {
                            managerEmp = employeeRepository.findByEmployeeNumberIgnoreCase(managerEmpNumber).orElse(null);
                        }

                        if (managerEmp != null && !managerEmp.getId().equals(employee.getId())) {
                            if (employee.getManager() == null || !employee.getManager().getId().equals(managerEmp.getId())) {
                                employee.setManager(managerEmp);
                                employeeRepository.save(employee);
                                managersLinked++;
                            }
                        }
                    }
                }
            }

            long durationMs = System.currentTimeMillis() - startMs;
            String summaryMsg = String.format("AD Sync finished in %d ms: %d users scanned, %d created, %d updated, %d disabled, %d managers linked, %d role assignments reconciled.",
                    durationMs, usersScanned, usersCreated, usersUpdated, usersDisabled, managersLinked, rolesAssigned);
            log.info(summaryMsg);

            return new AdSyncResult(true, summaryMsg, usersScanned, usersCreated, usersUpdated, usersDisabled,
                    managersLinked, rolesAssigned, durationMs, Instant.now());

        } catch (Exception ex) {
            long durationMs = System.currentTimeMillis() - startMs;
            log.error("Active Directory periodic synchronization failed: {}", ex.getMessage(), ex);
            return new AdSyncResult(false, "Sync failed: " + ex.getMessage(), 0, 0, 0, 0, 0, 0, durationMs, Instant.now());
        }
    }

    /**
     * Synchronizes role assignments for an individual user based on AD memberOf groups in real-time (used during login).
     */
    @Transactional
    public void syncRolesForUser(User user, List<String> memberOfDns) {
        if (user == null || user.getAuthProvider() != AuthProvider.ACTIVE_DIRECTORY) {
            return;
        }
        Map<String, Role> roleCache = loadRoleCache();
        syncRolesForUserInternal(user, memberOfDns, roleCache);
    }

    private int syncRolesForUserInternal(User user, List<String> memberOfDns, Map<String, Role> roleCache) {
        if (memberOfDns == null || memberOfDns.isEmpty()) {
            return 0;
        }

        // Extract CN group names from memberOf DNs
        Set<String> adGroupCns = memberOfDns.stream()
                .map(this::extractCnFromDn)
                .filter(Objects::nonNull)
                .collect(Collectors.toSet());

        // Determine target APID role names
        Set<String> targetRoleNames = new HashSet<>();
        for (String groupCn : adGroupCns) {
            String targetRole = DEFAULT_GROUP_ROLE_MAPPINGS.get(groupCn);
            if (targetRole != null) {
                targetRoleNames.add(targetRole);
            }
        }

        // Always guarantee at least the standard Employee role for any active AD user
        if (targetRoleNames.isEmpty() || !targetRoleNames.contains("Employee")) {
            targetRoleNames.add("Employee");
        }

        // Load existing active roles for this user
        List<UserRole> existingUserRoles = userRoleRepository.findAllByUserIdWithRole(user.getId());
        Set<String> existingRoleNames = existingUserRoles.stream()
                .filter(UserRole::isActive)
                .map(ur -> ur.getRole().getName())
                .collect(Collectors.toSet());

        int countAssigned = 0;

        // Assign any missing mapped roles
        for (String roleName : targetRoleNames) {
            if (!existingRoleNames.contains(roleName)) {
                Role role = roleCache.get(roleName.toLowerCase(Locale.ROOT));
                if (role != null) {
                    // Check if an inactive record already exists to re-activate
                    Optional<UserRole> existingRecord = existingUserRoles.stream()
                            .filter(ur -> ur.getRole().getId().equals(role.getId()))
                            .findFirst();

                    if (existingRecord.isPresent()) {
                        UserRole ur = existingRecord.get();
                        ur.setActive(true);
                        userRoleRepository.save(ur);
                    } else {
                        UserRole ur = new UserRole();
                        ur.setUser(user);
                        ur.setRole(role);
                        ur.setActive(true);
                        userRoleRepository.save(ur);
                    }
                    countAssigned++;
                }
            }
        }

        return countAssigned;
    }

    private String extractCnFromDn(String dn) {
        if (dn == null || !dn.toUpperCase(Locale.ROOT).contains("CN=")) {
            return null;
        }
        for (String part : dn.split(",")) {
            String trimmed = part.trim();
            if (trimmed.toUpperCase(Locale.ROOT).startsWith("CN=")) {
                return trimmed.substring(3).trim();
            }
        }
        return null;
    }

    private Department resolveDepartment(String deptName, Map<String, Department> cache) {
        if (deptName == null || deptName.isBlank()) {
            return cache.get("office of the chief executive");
        }
        String clean = deptName.trim().toLowerCase(Locale.ROOT);
        Department dept = cache.get(clean);
        if (dept != null) {
            return dept;
        }

        // Prefix/fuzzy matching for branch names
        for (Map.Entry<String, Department> entry : cache.entrySet()) {
            if (clean.contains(entry.getKey()) || entry.getKey().contains(clean)) {
                return entry.getValue();
            }
        }

        return null;
    }

    private Map<String, Department> loadDepartmentCache(List<Department> departments) {
        return departments.stream()
                .collect(Collectors.toMap(
                        department -> department.getName().trim().toLowerCase(Locale.ROOT),
                        department -> department,
                        (first, ignored) -> first
                ));
    }

    private Map<String, Department> loadDepartmentCodeCache(List<Department> departments) {
        return departments.stream()
                .filter(department -> department.getCode() != null && !department.getCode().isBlank())
                .collect(Collectors.toMap(
                        department -> normalizeDirectoryValue(department.getCode()),
                        department -> department,
                        (first, ignored) -> first
                ));
    }

    private boolean syncDepartmentsFromAd(
            List<AdSyncUserRecord> adUsers,
            List<Department> departments,
            Map<String, Department> departmentCache,
            Map<String, Department> departmentCodeCache
    ) {
        boolean changed = false;
        Set<String> districtIds = new LinkedHashSet<>();
        for (AdSyncUserRecord adUser : adUsers) {
            String districtId = normalizeDirectoryValue(adUser.districtId());
            if (districtId != null) {
                districtIds.add(districtId);
            }
        }

        for (String districtId : districtIds) {
            Department existingDistrict = departmentCodeCache.get(districtId);
            String districtName = resolveDistrictName(districtId, adUsers, existingDistrict);
            changed |= ensureAdDepartment(
                    districtId,
                    districtName,
                    null,
                    departments,
                    departmentCache,
                    departmentCodeCache
            );
        }

        for (AdSyncUserRecord adUser : adUsers) {
            String districtId = normalizeDirectoryValue(adUser.districtId());
            String branchId = normalizeDirectoryValue(adUser.branchId());
            if (districtId == null && branchId == null) {
                continue;
            }

            if (districtId == null) {
                log.warn(
                        "Could not map Active Directory branch {} for employee {} because DistrictID is missing",
                        adUser.branchId(),
                        adUser.employeeId()
                );
                continue;
            }

            Department district = departmentCodeCache.get(districtId);
            if (district == null) {
                log.warn("Could not resolve Active Directory district {} for employee {}", adUser.districtId(), adUser.employeeId());
                continue;
            }

            if (branchId == null && isDistrictRecord(adUser, district)) {
                continue;
            }

            String departmentName = branchId != null
                    ? firstNonBlank(adUser.physicalDeliveryOfficeName(), adUser.department(), adUser.branchId())
                    : firstNonBlank(adUser.department(), adUser.physicalDeliveryOfficeName());
            if (departmentName == null) continue;

            changed |= ensureAdDepartment(
                    branchId != null ? adUser.branchId().trim() : null,
                    departmentName,
                    district,
                    departments,
                    departmentCache,
                    departmentCodeCache
            );
        }

        for (AdSyncUserRecord adUser : adUsers) {
            if (normalizeDirectoryValue(adUser.districtId()) != null
                    || normalizeDirectoryValue(adUser.branchId()) != null) {
                continue;
            }

            String departmentName = firstNonBlank(adUser.department());
            if (departmentName == null) {
                continue;
            }

            changed |= ensureAdDepartment(
                    null,
                    departmentName,
                    null,
                    departments,
                    departmentCache,
                    departmentCodeCache
            );
        }

        return changed;
    }

    private boolean ensureAdDepartment(
            String code,
            String name,
            Department parent,
            List<Department> departments,
            Map<String, Department> departmentCache,
            Map<String, Department> departmentCodeCache
    ) {
        String normalizedCode = normalizeDirectoryValue(code);
        String normalizedName = normalizeDirectoryValue(name);
        if (normalizedName == null) {
            return false;
        }

        Department department = normalizedCode != null ? departmentCodeCache.get(normalizedCode) : null;
        if (department == null) {
            department = departments.stream()
                    .filter(candidate -> candidate.getName() != null
                            && candidate.getName().trim().equalsIgnoreCase(name.trim()))
                    .filter(candidate -> sameDepartmentParent(candidate.getParentDepartment(), parent))
                    .findFirst()
                    .orElse(null);
        }
        if (department == null && parent != null) {
            department = departments.stream()
                    .filter(candidate -> candidate.getName() != null
                            && candidate.getName().trim().equalsIgnoreCase(name.trim()))
                    .filter(candidate -> candidate.getParentDepartment() == null)
                    .filter(candidate -> !Objects.equals(candidate.getId(), parent.getId()))
                    .findFirst()
                    .orElse(null);
        }

        boolean changed = false;
        if (department == null) {
            department = new Department();
            department.setCode(code == null ? null : code.trim());
            department.setName(name.trim());
            department.setParentDepartment(parent);
            department.setActive(true);
            department = departmentRepository.save(department);
            departments.add(department);
            changed = true;
        } else {
            boolean update = false;
            if (normalizedCode != null
                    && (department.getCode() == null || department.getCode().isBlank())) {
                department.setCode(code.trim());
                update = true;
            }
            if (!sameDepartmentParent(department.getParentDepartment(), parent)) {
                department.setParentDepartment(parent);
                update = true;
            }
            if (update) {
                department = departmentRepository.save(department);
                changed = true;
            }
        }

        departmentCache.putIfAbsent(normalizedName, department);
        if (normalizedCode != null) {
            departmentCodeCache.putIfAbsent(normalizedCode, department);
        }
        return changed;
    }

    private boolean sameDepartmentParent(Department left, Department right) {
        Long leftId = left != null ? left.getId() : null;
        Long rightId = right != null ? right.getId() : null;
        return Objects.equals(leftId, rightId);
    }

    private String resolveDistrictName(
            String districtId,
            List<AdSyncUserRecord> adUsers,
            Department existingDistrict
    ) {
        if (existingDistrict != null && existingDistrict.getName() != null && !existingDistrict.getName().isBlank()) {
            return existingDistrict.getName().trim();
        }

        for (AdSyncUserRecord adUser : adUsers) {
            if (!districtId.equals(normalizeDirectoryValue(adUser.districtId()))) {
                continue;
            }

            String departmentName = normalizeDisplayValue(adUser.department());
            if (departmentName != null
                    && departmentName.toLowerCase(Locale.ROOT).contains("district")
                    && !departmentName.equalsIgnoreCase("district")) {
                return departmentName;
            }

            String title = normalizeDisplayValue(adUser.title());
            if (title != null && title.toLowerCase(Locale.ROOT).contains("district director")) {
                return firstNonBlank(adUser.physicalDeliveryOfficeName(), departmentName, districtId);
            }
        }

        return "District " + districtId;
    }

    private boolean isDistrictRecord(AdSyncUserRecord adUser, Department district) {
        String title = normalizeDisplayValue(adUser.title());
        if (title != null && title.toLowerCase(Locale.ROOT).contains("district director")) {
            return true;
        }

        String departmentName = normalizeDisplayValue(adUser.department());
        return departmentName != null
                && district.getName() != null
                && departmentName.equalsIgnoreCase(district.getName());
    }

    private String firstNonBlank(String... values) {
        for (String value : values) {
            if (value != null && !value.isBlank()) {
                return value.trim();
            }
        }
        return null;
    }

    private String normalizeDisplayValue(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    private String normalizeDirectoryValue(String value) {
        return value == null || value.isBlank() ? null : value.trim().toLowerCase(Locale.ROOT);
    }

    private Department resolveAdDepartment(
            AdSyncUserRecord adUser,
            List<Department> departments,
            Map<String, Department> departmentCache,
            Map<String, Department> departmentCodeCache
    ) {
        String branchId = normalizeDirectoryValue(adUser.branchId());
        if (branchId != null) {
            Department branch = departmentCodeCache.get(branchId);
            if (branch != null && branch.getParentDepartment() != null) return branch;
            log.warn("Active Directory branch {} was not resolved for employee {}", adUser.branchId(), adUser.employeeId());
            return null;
        }

        String districtId = normalizeDirectoryValue(adUser.districtId());
        if (districtId != null) {
            Department district = departmentCodeCache.get(districtId);
            if (district == null) {
                log.warn("Active Directory district {} was not resolved for employee {}", adUser.districtId(), adUser.employeeId());
                return null;
            }
            if (isDistrictRecord(adUser, district)) return district;

            String departmentName = firstNonBlank(adUser.department(), adUser.physicalDeliveryOfficeName());
            if (departmentName == null) return district;

            return departments.stream()
                    .filter(candidate -> candidate.getName() != null
                            && candidate.getName().trim().equalsIgnoreCase(departmentName))
                    .filter(candidate -> sameDepartmentParent(candidate.getParentDepartment(), district))
                    .findFirst()
                    .orElse(null);
        }

        return adUser.department() == null || adUser.department().isBlank()
                ? null
                : resolveDepartment(adUser.department(), departmentCache);
    }

    private Map<String, Role> loadRoleCache() {
        return roleRepository.findAll().stream()
                .collect(Collectors.toMap(r -> r.getName().toLowerCase(Locale.ROOT), r -> r, (a, b) -> a));
    }

    private List<AdSyncUserRecord> fetchAllAdUsers() {
        try {
            String searchBase = ldapProperties.getUserSearchBase() != null && !ldapProperties.getUserSearchBase().isBlank()
                    ? ldapProperties.getUserSearchBase()
                    : "";

            String relativeSearchBase = getRelativeSearchBase(searchBase, ldapProperties.getBaseDn());

            LdapQuery query = query()
                    .base(relativeSearchBase)
                    .attributes(
                            "distinguishedName", "sAMAccountName", "userPrincipalName",
                            "employeeID", "mail", "displayName", "givenName", "sn", "department",
                            "physicalDeliveryOfficeName", "DistrictID", "BranchID", "title",
                            "manager", "userAccountControl", "memberOf"
                    )
                    .filter("(&(objectCategory=person)(objectClass=user))");

            return ldapTemplate.search(query, (ContextMapper<AdSyncUserRecord>) ctx -> {
                DirContextAdapter adapter = (DirContextAdapter) ctx;
                String dn = adapter.getNameInNamespace();
                String sam = adapter.getStringAttribute("sAMAccountName");
                String upn = adapter.getStringAttribute("userPrincipalName");
                String empId = adapter.getStringAttribute("employeeID");
                String mail = adapter.getStringAttribute("mail");
                String display = adapter.getStringAttribute("displayName");
                String givenName = adapter.getStringAttribute("givenName");
                String sn = adapter.getStringAttribute("sn");
                String dept = adapter.getStringAttribute("department");
                String office = adapter.getStringAttribute("physicalDeliveryOfficeName");
                String districtId = adapter.getStringAttribute("DistrictID");
                String branchId = adapter.getStringAttribute("BranchID");
                String title = adapter.getStringAttribute("title");
                String managerDn = adapter.getStringAttribute("manager");

                String uacStr = adapter.getStringAttribute("userAccountControl");
                int uac = 0;
                if (uacStr != null) {
                    try {
                        uac = Integer.parseInt(uacStr);
                    } catch (NumberFormatException ignored) {}
                }

                String[] memberOfArray = adapter.getStringAttributes("memberOf");
                List<String> memberOfList = memberOfArray != null
                        ? Arrays.asList(memberOfArray)
                        : List.of();

                return new AdSyncUserRecord(
                        dn, sam, upn, empId, mail, display, givenName, sn, dept,
                        office, districtId, branchId, title, managerDn, uac, memberOfList
                );
            });
        } catch (Exception ex) {
            log.error("Failed to fetch user list from Active Directory: {}", ex.getMessage(), ex);
            return List.of();
        }
    }

    private String getRelativeSearchBase(String searchBase, String baseDn) {
        if (searchBase == null || searchBase.isBlank() || baseDn == null || baseDn.isBlank()) {
            return "";
        }
        String cleanSearch = searchBase.trim().toLowerCase(Locale.ROOT);
        String cleanBase = baseDn.trim().toLowerCase(Locale.ROOT);
        if (cleanSearch.endsWith(cleanBase)) {
            String relative = searchBase.substring(0, searchBase.length() - baseDn.length()).trim();
            if (relative.endsWith(",")) {
                relative = relative.substring(0, relative.length() - 1).trim();
            }
            return relative;
        }
        return searchBase;
    }

    private String resolveFullName(AdSyncUserRecord adUser, String fallback) {
        String gn = adUser.givenName() != null ? adUser.givenName().trim() : null;
        String sn = adUser.sn() != null ? adUser.sn().trim() : null;
        String dn = adUser.displayName() != null ? adUser.displayName().trim() : null;

        // In Windows Active Directory (ADUC), editing First name changes givenName,
        // but displayName remains unchanged unless explicitly edited.
        // If givenName and sn exist:
        if (gn != null && !gn.isEmpty() && sn != null && !sn.isEmpty()) {
            if (dn != null && !dn.isEmpty() && dn.toLowerCase(Locale.ROOT).contains(gn.toLowerCase(Locale.ROOT))) {
                return dn;
            }
            return gn + " " + sn;
        }

        if (dn != null && !dn.isEmpty()) {
            return dn;
        }
        if (gn != null && !gn.isEmpty()) {
            return gn;
        }
        if (sn != null && !sn.isEmpty()) {
            return sn;
        }
        return fallback;
    }

    public record AdSyncUserRecord(
            String distinguishedName,
            String samAccountName,
            String userPrincipalName,
            String employeeId,
            String mail,
            String displayName,
            String givenName,
            String sn,
            String department,
            String physicalDeliveryOfficeName,
            String districtId,
            String branchId,
            String title,
            String managerDn,
            int userAccountControl,
            List<String> memberOfGroups
    ) {}

    public record AdSyncResult(
            boolean success,
            String message,
            int usersScanned,
            int usersCreated,
            int usersUpdated,
            int usersDisabled,
            int managersLinked,
            int rolesAssigned,
            long durationMs,
            Instant completedAt
    ) {}
}
