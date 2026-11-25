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
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
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
            "APID-PMS-OVERSIGHT", "HR Admin",
            "APID-ALL-EMPLOYEES", "Employee",
            "APID-PMS-EMPLOYEES", "Employee"
    );

    private final LdapProperties ldapProperties;
    private final LdapTemplate ldapTemplate;
    private final UserRepository userRepository;
    private final EmployeeRepository employeeRepository;
    private final DepartmentRepository departmentRepository;
    private final RoleRepository roleRepository;
    private final UserRoleRepository userRoleRepository;

    public ActiveDirectorySyncService(
            LdapProperties ldapProperties,
            LdapTemplate ldapTemplate,
            UserRepository userRepository,
            EmployeeRepository employeeRepository,
            DepartmentRepository departmentRepository,
            RoleRepository roleRepository,
            UserRoleRepository userRoleRepository
    ) {
        this.ldapProperties = ldapProperties;
        this.ldapTemplate = ldapTemplate;
        this.userRepository = userRepository;
        this.employeeRepository = employeeRepository;
        this.departmentRepository = departmentRepository;
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
            Map<String, Department> departmentCache = loadDepartmentCache();
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
                if (isTechnicalServiceAccount(adUser, normalizedUsername)) {
                    log.info("Skipping technical/service account '{}' from employee sync", normalizedUsername);
                    continue;
                }
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

                // 2. Resolve Department
                Department dept = resolveDepartment(adUser.department(), departmentCache);

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
                employee.setDepartment(dept);
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

    private Map<String, Department> loadDepartmentCache() {
        return departmentRepository.findAllByOrderByNameAsc().stream()
                .collect(Collectors.toMap(d -> d.getName().toLowerCase(Locale.ROOT), d -> d, (a, b) -> a));
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
                            "employeeID", "mail", "displayName", "givenName", "sn", "department", "title",
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

                return new AdSyncUserRecord(dn, sam, upn, empId, mail, display, givenName, sn, dept, title, managerDn, uac, memberOfList);
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

    private boolean isTechnicalServiceAccount(AdSyncUserRecord adUser, String normalizedUsername) {
        if (normalizedUsername == null) return false;
        if (normalizedUsername.startsWith("svc_")
                || normalizedUsername.startsWith("svc-")
                || normalizedUsername.equals("svc_apid_ldap")
                || normalizedUsername.equalsIgnoreCase("krbtgt")) {
            return true;
        }
        if (adUser.distinguishedName() != null) {
            String lowerDn = adUser.distinguishedName().toLowerCase(Locale.ROOT);
            if (lowerDn.contains("ou=service accounts") || lowerDn.contains("ou=system accounts")) {
                return true;
            }
        }
        if (ldapProperties.getBindDn() != null && adUser.distinguishedName() != null
                && adUser.distinguishedName().equalsIgnoreCase(ldapProperties.getBindDn())) {
            return true;
        }
        return false;
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
