package com.boa.apid.core.auth;

import com.boa.apid.core.audit.repository.AuditLogRepository;
import com.boa.apid.core.auth.controller.AuthController;
import com.boa.apid.core.auth.dto.ChangePasswordRequest;
import com.boa.apid.core.auth.dto.LoginRequest;
import com.boa.apid.core.authorization.dto.CreateRoleRequest;
import com.boa.apid.core.authorization.dto.UpdateRolePermissionsRequest;
import com.boa.apid.core.authorization.dto.UpdateRoleRequest;
import com.boa.apid.core.authorization.entity.*;
import com.boa.apid.core.authorization.repository.PermissionRepository;
import com.boa.apid.core.authorization.repository.RoleRepository;
import com.boa.apid.core.authorization.repository.UserRepository;
import com.boa.apid.core.authorization.repository.UserRoleRepository;
import com.boa.apid.core.authorization.service.PermissionCacheStore;
import com.boa.apid.core.identity.dto.CreateUserRequest;
import com.boa.apid.core.identity.dto.UpdateUserRolesRequest;
import com.boa.apid.core.identity.dto.UpdateUserStatusRequest;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.cache.Cache;
import org.springframework.cache.CacheManager;
import org.springframework.dao.DataAccessException;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import java.time.Instant;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicInteger;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class Phase2AdminRbacIntegrationTest {

    private static final String TEST_PASS = "Phase2Pass!2026";
    private static final AtomicInteger IP_SEQ = new AtomicInteger(1);

    @Autowired private MockMvc mockMvc;
    @Autowired private ObjectMapper objectMapper;
    @Autowired private UserRepository userRepository;
    @Autowired private RoleRepository roleRepository;
    @Autowired private PermissionRepository permissionRepository;
    @Autowired private UserRoleRepository userRoleRepository;
    @Autowired private AuditLogRepository auditLogRepository;
    @Autowired private PasswordEncoder passwordEncoder;
    @Autowired private CacheManager cacheManager;
    @Autowired private JdbcTemplate jdbcTemplate;

    private Role superAdminRole;
    private Role employeeRole;

    @BeforeEach
    void setUp() {
        superAdminRole = roleRepository.findByNameIgnoreCase("Super Admin")
                .orElseThrow(() -> new IllegalStateException("Super Admin role must exist"));
        employeeRole = roleRepository.findByNameIgnoreCase("Employee")
                .orElseThrow(() -> new IllegalStateException("Employee role must exist"));

        Cache cache = cacheManager.getCache(PermissionCacheStore.CACHE_NAME);
        if (cache != null) {
            cache.clear();
        }
    }

    @Test
    void livePermissionCacheEvictionOnRolePermissionUpdate() throws Exception {
        String s = suffix();
        Role customRole = createCustomRole("P2_CacheRole_" + s, Set.of("USER_MANAGE", "EMPLOYEE_PORTAL_ACCESS"));
        User actor = createDirectUser("p2_cache_user_" + s, TEST_PASS, false, customRole);
        User superAdmin = createDirectUser("p2_sa_cache_" + s, TEST_PASS, false, superAdminRole);

        LoginSession actorSession = login(actor.getUsername(), TEST_PASS);
        LoginSession saSession = login(superAdmin.getUsername(), TEST_PASS);

        // 1. Authorized request populates Redis user_permissions cache
        mockMvc.perform(get("/api/v1/core/admin/users")
                        .header("Authorization", "Bearer " + actorSession.accessToken()))
                .andExpect(status().isOk());

        Cache cache = cacheManager.getCache(PermissionCacheStore.CACHE_NAME);
        assertThat(cache).isNotNull();
        assertThat(cache.get(actor.getId())).isNotNull();

        // 2. Super Admin removes USER_MANAGE while user stays logged in
        mockMvc.perform(put("/api/v1/core/admin/roles/" + customRole.getId() + "/permissions")
                        .header("Authorization", "Bearer " + saSession.accessToken())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(
                                new UpdateRolePermissionsRequest(Set.of("EMPLOYEE_PORTAL_ACCESS")))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.permissions.length()").value(1));

        // 3. Post-commit eviction means the very next request with the SAME JWT gets 403 Forbidden
        assertThat(cache.get(actor.getId())).isNull();

        mockMvc.perform(get("/api/v1/core/admin/users")
                        .header("Authorization", "Bearer " + actorSession.accessToken()))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.errorCode").value("ACCESS_DENIED"));
    }

    @Test
    void userLifecycle_create_duplicateConflict_statusDisableRevokesSession_selfDisableBlocked_unlockBehavior() throws Exception {
        String s = suffix();
        User sa = createDirectUser("p2_sa_user_" + s, TEST_PASS, false, superAdminRole);
        LoginSession saSession = login(sa.getUsername(), TEST_PASS);

        String targetUsername = "p2_target_" + s;

        // 1. Create user without password -> generates SecureRandom temporary password
        MvcResult createResult = mockMvc.perform(post("/api/v1/core/admin/users")
                        .header("Authorization", "Bearer " + saSession.accessToken())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(
                                new CreateUserRequest(targetUsername, null, Set.of(employeeRole.getId())))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.user.username").value(targetUsername))
                .andExpect(jsonPath("$.data.user.mustChangePassword").value(true))
                .andExpect(jsonPath("$.data.temporaryPassword").isNotEmpty())
                .andReturn();

        JsonNode createNode = objectMapper.readTree(createResult.getResponse().getContentAsString());
        Long targetUserId = createNode.at("/data/user/id").asLong();
        String tempPass = createNode.at("/data/temporaryPassword").asText();
        assertThat(tempPass.length()).isGreaterThanOrEqualTo(12);

        // Audit metadata must NOT persist raw temporary password
        String rawDetails = jdbcTemplate.queryForObject(
                "SELECT COALESCE(details_json::text, '') FROM core.audit_logs WHERE action = 'USER_CREATED' AND target_user_id = ? ORDER BY id DESC LIMIT 1",
                String.class,
                targetUserId
        );
        assertThat(rawDetails).doesNotContain(tempPass);

        // 2. Duplicate username (case-insensitive) -> 409 CONFLICT
        mockMvc.perform(post("/api/v1/core/admin/users")
                        .header("Authorization", "Bearer " + saSession.accessToken())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(
                                new CreateUserRequest(targetUsername.toUpperCase(Locale.ROOT), null, Set.of(employeeRole.getId())))))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.errorCode").value("USERNAME_EXISTS"));

        // 3. Target user logs in, changes password, and gets a full session
        LoginSession initialLogin = login(targetUsername, tempPass);
        mockMvc.perform(post("/api/v1/core/auth/change-password")
                        .header("Authorization", "Bearer " + initialLogin.accessToken())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(
                                new ChangePasswordRequest(tempPass, "TargetNewPass!2026"))))
                .andExpect(status().isOk());

        LoginSession activeTargetSession = login(targetUsername, "TargetNewPass!2026");
        mockMvc.perform(get("/api/v1/core/auth/me")
                        .header("Authorization", "Bearer " + activeTargetSession.accessToken()))
                .andExpect(status().isOk());

        // 4. Self-disable is rejected
        mockMvc.perform(patch("/api/v1/core/admin/users/" + sa.getId() + "/status")
                        .header("Authorization", "Bearer " + saSession.accessToken())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(
                                new UpdateUserStatusRequest(UserStatus.DISABLED, "Self attempt"))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errorCode").value("SELF_MODIFICATION_BLOCKED"));

        // 5. Disabling target user immediately revokes access token + refresh token
        mockMvc.perform(patch("/api/v1/core/admin/users/" + targetUserId + "/status")
                        .header("Authorization", "Bearer " + saSession.accessToken())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(
                                new UpdateUserStatusRequest(UserStatus.DISABLED, "Offboarded"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("DISABLED"));

        mockMvc.perform(get("/api/v1/core/auth/me")
                        .header("Authorization", "Bearer " + activeTargetSession.accessToken()))
                .andExpect(status().isUnauthorized());

        CsrfBundle csrf = fetchCsrf();
        mockMvc.perform(post("/api/v1/core/auth/refresh")
                        .cookie(activeTargetSession.refreshCookie(), csrf.cookie())
                        .header("X-XSRF-TOKEN", csrf.token()))
                .andExpect(status().isUnauthorized());

        // 6. Unlock clears temporary lockout counters without re-enabling a DISABLED user
        User lockedDisabled = userRepository.findById(targetUserId).orElseThrow();
        lockedDisabled.setFailedLoginAttempts(4);
        lockedDisabled.setLockedUntil(Instant.now().plusSeconds(300));
        userRepository.save(lockedDisabled);

        mockMvc.perform(post("/api/v1/core/admin/users/" + targetUserId + "/unlock")
                        .header("Authorization", "Bearer " + saSession.accessToken()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("DISABLED"))
                .andExpect(jsonPath("$.data.temporarilyLocked").value(false))
                .andExpect(jsonPath("$.data.failedLoginAttempts").value(0));

        // 7. Admin reset password returns new password and clears lockout / marks mustChangePassword
        mockMvc.perform(post("/api/v1/core/admin/users/" + targetUserId + "/reset-password")
                        .header("Authorization", "Bearer " + saSession.accessToken()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.temporaryPassword").isNotEmpty());
    }

    @Test
    void userRoleHistory_revokeAndReassignPreservesHistory() throws Exception {
        String s = suffix();
        Role roleA = createCustomRole("P2_HistA_" + s, Set.of("EMPLOYEE_PORTAL_ACCESS"));
        Role roleB = createCustomRole("P2_HistB_" + s, Set.of("COACHING_REQUEST_SUBMIT"));
        User sa = createDirectUser("p2_sa_hist_" + s, TEST_PASS, false, superAdminRole);
        User target = createDirectUser("p2_hist_user_" + s, TEST_PASS, false, roleA);
        LoginSession saSession = login(sa.getUsername(), TEST_PASS);

        // Move from roleA -> roleB
        mockMvc.perform(put("/api/v1/core/admin/users/" + target.getId() + "/roles")
                        .header("Authorization", "Bearer " + saSession.accessToken())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new UpdateUserRolesRequest(Set.of(roleB.getId())))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.roles[0].name").value(roleB.getName()));

        Integer inactiveRoleACount = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM core.user_roles WHERE user_id = ? AND role_id = ? AND active = FALSE AND revoked_by IS NOT NULL AND revoked_at IS NOT NULL",
                Integer.class,
                target.getId(), roleA.getId()
        );
        assertThat(inactiveRoleACount).isEqualTo(1);

        // Reassign back to roleA (partial unique index WHERE active = TRUE permits re-assignment!)
        mockMvc.perform(put("/api/v1/core/admin/users/" + target.getId() + "/roles")
                        .header("Authorization", "Bearer " + saSession.accessToken())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new UpdateUserRolesRequest(Set.of(roleA.getId())))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.roles[0].name").value(roleA.getName()));

        Integer totalRoleAHistoryRows = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM core.user_roles WHERE user_id = ? AND role_id = ?",
                Integer.class,
                target.getId(), roleA.getId()
        );
        assertThat(totalRoleAHistoryRows).isEqualTo(2);
    }

    @Test
    void privilegeEscalationDenied_forNonSuperAdmin() throws Exception {
        String s = suffix();
        Role roleOperatorRole = createCustomRole("P2_RoleOp_" + s, Set.of("ROLE_PERMISSION_MANAGE", "EMPLOYEE_PORTAL_ACCESS"));
        User roleOperator = createDirectUser("p2_roleop_" + s, TEST_PASS, false, roleOperatorRole);

        Role userAdminRole = createCustomRole("P2_UserOp_" + s, Set.of("USER_MANAGE", "EMPLOYEE_PORTAL_ACCESS"));
        User userAdmin = createDirectUser("p2_userop_" + s, TEST_PASS, false, userAdminRole);

        LoginSession roleOpSession = login(roleOperator.getUsername(), TEST_PASS);
        LoginSession userOpSession = login(userAdmin.getUsername(), TEST_PASS);

        // Role operator cannot create a role with AUDIT_LOG_VIEW (which they do not hold)
        mockMvc.perform(post("/api/v1/core/admin/roles")
                        .header("Authorization", "Bearer " + roleOpSession.accessToken())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(
                                new CreateRoleRequest("Escalated_" + s, "Should fail", Set.of("AUDIT_LOG_VIEW")))))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.errorCode").value("PRIVILEGE_ESCALATION_DENIED"));

        // Non-Super Admin cannot mutate protected Super Admin role permissions
        mockMvc.perform(put("/api/v1/core/admin/roles/" + superAdminRole.getId() + "/permissions")
                        .header("Authorization", "Bearer " + roleOpSession.accessToken())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(
                                new UpdateRolePermissionsRequest(Set.of("EMPLOYEE_PORTAL_ACCESS")))))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.errorCode").value("PROTECTED_ROLE"));

        // Limited User Admin cannot create user with Super Admin or higher-privilege role (PMS Admin)
        Role pmsAdminRole = roleRepository.findByNameIgnoreCase("PMS Admin").orElseThrow();
        mockMvc.perform(post("/api/v1/core/admin/users")
                        .header("Authorization", "Bearer " + userOpSession.accessToken())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(
                                new CreateUserRequest("p2_esc_" + s, null, Set.of(superAdminRole.getId())))))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.errorCode").value("PRIVILEGE_ESCALATION_DENIED"));

        mockMvc.perform(post("/api/v1/core/admin/users")
                        .header("Authorization", "Bearer " + userOpSession.accessToken())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(
                                new CreateUserRequest("p2_esc2_" + s, null, Set.of(pmsAdminRole.getId())))))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.errorCode").value("PRIVILEGE_ESCALATION_DENIED"));
    }

    @Test
    void superAdminProtection_protectsRoleAndLastActiveAdmin_evenUnderConcurrency() throws Exception {
        String s = suffix();
        User saA = createDirectUser("p2_sa_a_" + s, TEST_PASS, false, superAdminRole);
        User saB = createDirectUser("p2_sa_b_" + s, TEST_PASS, false, superAdminRole);
        LoginSession saASession = login(saA.getUsername(), TEST_PASS);

        // 1. Protected role cannot be deactivated or renamed
        mockMvc.perform(put("/api/v1/core/admin/roles/" + superAdminRole.getId())
                        .header("Authorization", "Bearer " + saASession.accessToken())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(
                                new UpdateRoleRequest("Super Admin", "Attempt deactivate", false))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errorCode").value("PROTECTED_ROLE"));

        // 2. Removing critical governance permission USER_MANAGE from Super Admin is blocked
        Set<String> withoutUserManage = new LinkedHashSet<>();
        for (Permission p : permissionRepository.findAll()) {
            if (!"USER_MANAGE".equals(p.getCode())) {
                withoutUserManage.add(p.getCode());
            }
        }
        mockMvc.perform(put("/api/v1/core/admin/roles/" + superAdminRole.getId() + "/permissions")
                        .header("Authorization", "Bearer " + saASession.accessToken())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new UpdateRolePermissionsRequest(withoutUserManage))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errorCode").value("PROTECTED_ROLE_PERMISSION"));

        // 3. Concurrency-safe last Super Admin check: keep ONLY saA and saB active temporarily
        List<User> temporarilyDisabledOthers = new ArrayList<>();
        try {
            for (User u : userRepository.findAll()) {
                if (!u.getId().equals(saA.getId()) && !u.getId().equals(saB.getId())
                        && u.getStatus() == UserStatus.ACTIVE) {
                    boolean isSuper = userRoleRepository.findActiveRoleNamesByUserId(u.getId())
                            .stream().anyMatch(n -> "Super Admin".equalsIgnoreCase(n));
                    if (isSuper) {
                        u.setStatus(UserStatus.DISABLED);
                        userRepository.save(u);
                        temporarilyDisabledOthers.add(u);
                    }
                }
            }

            final Long saAId = saA.getId();
            final Long saBId = saB.getId();
            LoginSession sessionA = login(saA.getUsername(), TEST_PASS);
            LoginSession sessionB = login(saB.getUsername(), TEST_PASS);

            // saA tries to disable saB AT THE SAME TIME saB tries to disable saA
            ExecutorService pool = Executors.newFixedThreadPool(2);
            CountDownLatch ready = new CountDownLatch(2);
            CountDownLatch start = new CountDownLatch(1);

            Callable<Integer> disableB = () -> {
                ready.countDown();
                start.await(5, TimeUnit.SECONDS);
                return mockMvc.perform(patch("/api/v1/core/admin/users/" + saBId + "/status")
                                .header("Authorization", "Bearer " + sessionA.accessToken())
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(objectMapper.writeValueAsString(
                                        new UpdateUserStatusRequest(UserStatus.DISABLED, "Concurrent 1"))))
                        .andReturn().getResponse().getStatus();
            };

            Callable<Integer> disableA = () -> {
                ready.countDown();
                start.await(5, TimeUnit.SECONDS);
                return mockMvc.perform(patch("/api/v1/core/admin/users/" + saAId + "/status")
                                .header("Authorization", "Bearer " + sessionB.accessToken())
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(objectMapper.writeValueAsString(
                                        new UpdateUserStatusRequest(UserStatus.DISABLED, "Concurrent 2"))))
                        .andReturn().getResponse().getStatus();
            };

            Future<Integer> f1 = pool.submit(disableB);
            Future<Integer> f2 = pool.submit(disableA);
            assertThat(ready.await(5, TimeUnit.SECONDS)).isTrue();
            start.countDown();

            int status1 = f1.get(15, TimeUnit.SECONDS);
            int status2 = f2.get(15, TimeUnit.SECONDS);
            pool.shutdownNow();

            List<Integer> statuses = List.of(status1, status2);
            // Advisory lock guarantees at least one active Super Admin ALWAYS survives (never two 200s!)
            assertThat(statuses.stream().filter(st -> st == 200).count()).isLessThanOrEqualTo(1);
            assertThat(userRepository.countActiveSuperAdmins()).isGreaterThanOrEqualTo(1L);
        } finally {
            for (User u : temporarilyDisabledOthers) {
                User fresh = userRepository.findById(u.getId()).orElseThrow();
                fresh.setStatus(UserStatus.ACTIVE);
                userRepository.save(fresh);
            }
            // Restore saA and saB as ACTIVE just in case before cleanup
            saA = userRepository.findById(saA.getId()).orElseThrow();
            saA.setStatus(UserStatus.ACTIVE);
            userRepository.save(saA);
            saB = userRepository.findById(saB.getId()).orElseThrow();
            saB.setStatus(UserStatus.ACTIVE);
            userRepository.save(saB);
        }
    }

    @Test
    void auditLogs_immutableInDb_requiresAuditPermission_andCapturesFailedLogin() throws Exception {
        String s = suffix();
        User employee = createDirectUser("p2_audit_emp_" + s, TEST_PASS, false, employeeRole);
        User sa = createDirectUser("p2_audit_sa_" + s, TEST_PASS, false, superAdminRole);

        // 1. Failed login emits audit event via REQUIRES_NEW
        mockMvc.perform(post("/api/v1/core/auth/login")
                        .header("X-Forwarded-For", nextIp())
                        .header("User-Agent", "Phase2JUnitAgent/1.0")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(
                                new LoginRequest(employee.getUsername(), "WrongPassword!99"))))
                .andExpect(status().isUnauthorized());

        LoginSession empSession = login(employee.getUsername(), TEST_PASS);
        LoginSession saSession = login(sa.getUsername(), TEST_PASS);

        // 2. Employee without AUDIT_LOG_VIEW gets 403 Forbidden
        mockMvc.perform(get("/api/v1/core/admin/audit-logs")
                        .header("Authorization", "Bearer " + empSession.accessToken()))
                .andExpect(status().isForbidden());

        // 3. Super Admin can query AUTH / LOGIN_FAILED event with metadata
        MvcResult auditRes = mockMvc.perform(get("/api/v1/core/admin/audit-logs")
                        .param("module", "AUTH")
                        .param("action", "LOGIN_FAILED")
                        .param("actorUsername", employee.getUsername())
                        .header("Authorization", "Bearer " + saSession.accessToken()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.content.length()").value(1))
                .andExpect(jsonPath("$.data.content[0].result").value("FAILURE"))
                .andExpect(jsonPath("$.data.content[0].userAgent").value("Phase2JUnitAgent/1.0"))
                .andReturn();

        Long logId = objectMapper.readTree(auditRes.getResponse().getContentAsString())
                .at("/data/content/0/id").asLong();

        // 4. PostgreSQL trigger blocks UPDATE and DELETE on core.audit_logs
        assertThatThrownBy(() -> jdbcTemplate.update(
                "UPDATE core.audit_logs SET action = 'TAMPERED' WHERE id = ?", logId))
                .isInstanceOf(DataAccessException.class);

        assertThatThrownBy(() -> jdbcTemplate.update(
                "DELETE FROM core.audit_logs WHERE id = ?", logId))
                .isInstanceOf(DataAccessException.class);
    }

    @Test
    void paginationAndSortingValidation() throws Exception {
        String s = suffix();
        User sa = createDirectUser("p2_sa_page_" + s, TEST_PASS, false, superAdminRole);
        LoginSession saSession = login(sa.getUsername(), TEST_PASS);

        mockMvc.perform(get("/api/v1/core/admin/users")
                        .param("size", "101")
                        .header("Authorization", "Bearer " + saSession.accessToken()))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errorCode").value("INVALID_PAGE_SIZE"));

        mockMvc.perform(get("/api/v1/core/admin/users")
                        .param("sortBy", "passwordHash")
                        .header("Authorization", "Bearer " + saSession.accessToken()))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errorCode").value("INVALID_SORT_FIELD"));
    }

    // --- Helpers ---

    private Role createCustomRole(String name, Set<String> permissionCodes) {
        Role role = new Role();
        role.setName(name);
        role.setDescription("Phase 2 test role");
        role.setSystemProtected(false);
        role.setActive(true);
        Set<Permission> perms = new LinkedHashSet<>();
        for (String code : permissionCodes) {
            perms.add(permissionRepository.findByCode(code)
                    .orElseThrow(() -> new IllegalStateException("Missing permission: " + code)));
        }
        role.setPermissions(perms);
        return roleRepository.save(role);
    }

    private User createDirectUser(String username, String rawPassword, boolean mustChangePassword, Role... roles) {
        User user = new User();
        user.setUsername(username.toLowerCase(Locale.ROOT));
        user.setPasswordHash(passwordEncoder.encode(rawPassword));
        user.setAuthProvider(AuthProvider.LOCAL);
        user.setStatus(UserStatus.ACTIVE);
        user.setMustChangePassword(mustChangePassword);
        User saved = userRepository.save(user);

        for (Role r : roles) {
            UserRole ur = new UserRole();
            ur.setUser(saved);
            ur.setRole(r);
            ur.setActive(true);
            userRoleRepository.save(ur);
        }
        return saved;
    }

    private LoginSession login(String username, String password) throws Exception {
        MvcResult result = mockMvc.perform(post("/api/v1/core/auth/login")
                        .header("X-Forwarded-For", nextIp())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new LoginRequest(username, password))))
                .andExpect(status().isOk())
                .andReturn();

        JsonNode body = objectMapper.readTree(result.getResponse().getContentAsString());
        String accessToken = body.at("/data/accessToken").asText();
        Cookie refreshCookie = result.getResponse().getCookie(AuthController.REFRESH_COOKIE_NAME);
        assertThat(refreshCookie).isNotNull();
        return new LoginSession(accessToken, refreshCookie);
    }

    private CsrfBundle fetchCsrf() throws Exception {
        MvcResult result = mockMvc.perform(get("/api/v1/core/auth/csrf"))
                .andExpect(status().isOk())
                .andReturn();
        String token = objectMapper.readTree(result.getResponse().getContentAsString()).at("/data").asText();
        Cookie cookie = result.getResponse().getCookie("XSRF-TOKEN");
        assertThat(cookie).isNotNull();
        return new CsrfBundle(token, cookie);
    }

    private static String suffix() {
        return UUID.randomUUID().toString().substring(0, 8);
    }

    private static String nextIp() {
        int seq = IP_SEQ.getAndIncrement();
        return "10.200." + (seq / 250) + "." + ((seq % 250) + 1);
    }

    private record LoginSession(String accessToken, Cookie refreshCookie) {}

    private record CsrfBundle(String token, Cookie cookie) {}
}
