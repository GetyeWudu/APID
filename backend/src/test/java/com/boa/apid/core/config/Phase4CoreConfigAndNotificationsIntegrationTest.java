package com.boa.apid.core.config;

import com.boa.apid.common.exception.BusinessException;
import com.boa.apid.core.audit.entity.AuditLog;
import com.boa.apid.core.audit.repository.AuditLogRepository;
import com.boa.apid.core.auth.controller.AuthController;
import com.boa.apid.core.auth.dto.LoginRequest;
import com.boa.apid.core.authorization.entity.*;
import com.boa.apid.core.authorization.repository.PermissionRepository;
import com.boa.apid.core.authorization.repository.RoleRepository;
import com.boa.apid.core.authorization.repository.UserRepository;
import com.boa.apid.core.authorization.repository.UserRoleRepository;
import com.boa.apid.core.config.dto.CreateFiscalQuarterRequest;
import com.boa.apid.core.config.dto.UpdateFiscalQuarterRequest;
import com.boa.apid.core.config.dto.UpdateSystemConfigsRequest;
import com.boa.apid.core.config.entity.FiscalQuarter;
import com.boa.apid.core.config.entity.SystemConfig;
import com.boa.apid.core.config.repository.FiscalQuarterRepository;
import com.boa.apid.core.config.repository.SystemConfigRepository;
import com.boa.apid.core.notifications.entity.*;
import com.boa.apid.core.notifications.repository.NotificationOutboxRepository;
import com.boa.apid.core.notifications.repository.NotificationRepository;
import com.boa.apid.core.notifications.service.NotificationOutboxDispatcher;
import com.boa.apid.core.notifications.service.NotificationService;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.cache.Cache;
import org.springframework.cache.CacheManager;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
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
class Phase4CoreConfigAndNotificationsIntegrationTest {

    private static final String TEST_PASS = "Phase4Pass!2026";
    private static final AtomicInteger IP_SEQ = new AtomicInteger(1);
    private static final AtomicInteger YEAR_SEQ = new AtomicInteger(2040);

    @Autowired private MockMvc mockMvc;
    @Autowired private ObjectMapper objectMapper;
    @Autowired private UserRepository userRepository;
    @Autowired private RoleRepository roleRepository;
    @Autowired private PermissionRepository permissionRepository;
    @Autowired private UserRoleRepository userRoleRepository;
    @Autowired private AuditLogRepository auditLogRepository;
    @Autowired private FiscalQuarterRepository fiscalQuarterRepository;
    @Autowired private SystemConfigRepository systemConfigRepository;
    @Autowired private NotificationRepository notificationRepository;
    @Autowired private NotificationOutboxRepository outboxRepository;
    @Autowired private NotificationService notificationService;
    @Autowired private NotificationOutboxDispatcher outboxDispatcher;
    @Autowired private PasswordEncoder passwordEncoder;
    @Autowired private CacheManager cacheManager;
    @Autowired private JdbcTemplate jdbcTemplate;

    private Role employeeRole;
    private FiscalQuarter seededQ2;

    @BeforeEach
    void setUp() {
        employeeRole = roleRepository.findByNameIgnoreCase("Employee")
                .orElseThrow(() -> new IllegalStateException("Employee role must exist"));
        seededQ2 = fiscalQuarterRepository.findByFiscalYearIgnoreCaseAndQuarter("2026/27", (short) 2)
                .orElseThrow(() -> new IllegalStateException("Seeded FY 2026/27 Q2 must exist"));

        ensureQ2Active();
        clearConfigCaches();
    }

    @Test
    void activeConfig_seededQ2Active_allowlistsPublicFields_andBlocksMustChangePassword() throws Exception {
        String s = suffix();
        User employee = createDirectUser("p4_emp_cfg_" + s, TEST_PASS, false, employeeRole);
        User mustChange = createDirectUser("p4_mcp_cfg_" + s, TEST_PASS, true, employeeRole);

        String empToken = login(employee.getUsername(), TEST_PASS);
        String mcpToken = login(mustChange.getUsername(), TEST_PASS);

        MvcResult res = mockMvc.perform(get("/api/v1/core/config/active")
                        .header("Authorization", "Bearer " + empToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.activeQuarter.fiscalYear").value("2026/27"))
                .andExpect(jsonPath("$.data.activeQuarter.quarter").value(2))
                .andExpect(jsonPath("$.data.activeQuarter.label").value("FY 2026/27 · Q2"))
                .andExpect(jsonPath("$.data.publicConfig.mandatoryCutoffRounded").value(3))
                .andExpect(jsonPath("$.data.publicConfig.missedSessionAlertThreshold").value(2))
                .andExpect(jsonPath("$.data.publicConfig.inactivityReminderDays").value(14))
                .andExpect(jsonPath("$.data.publicConfig.maxFileUploadMb").value(25))
                .andReturn();

        // Internal-only mentoring cap must NOT be leaked in public active config payload
        String rawJson = res.getResponse().getContentAsString();
        assertThat(rawJson).doesNotContain("default_max_trainees_per_trainer");
        assertThat(rawJson).doesNotContain("defaultMaxTraineesPerTrainer");

        // Second call hits Redis cache cleanly (verifies NON_FINAL deserialization)
        mockMvc.perform(get("/api/v1/core/config/active")
                        .header("Authorization", "Bearer " + empToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.activeQuarter.quarter").value(2));

        // Must-change-password user blocked
        mockMvc.perform(get("/api/v1/core/config/active")
                        .header("Authorization", "Bearer " + mcpToken))
                .andExpect(status().isForbidden());
    }

    @Test
    void adminConfig_rbac_typedValidation_auditDiff_andCacheEviction() throws Exception {
        String s = suffix();
        Role configAdminRole = createCustomRole("P4_ConfigAdmin_" + s,
                Set.of("EMPLOYEE_PORTAL_ACCESS", "SYSTEM_CONFIG_MANAGE"));
        User employee = createDirectUser("p4_emp_rbac_" + s, TEST_PASS, false, employeeRole);
        User admin = createDirectUser("p4_adm_cfg_" + s, TEST_PASS, false, configAdminRole);

        String empToken = login(employee.getUsername(), TEST_PASS);
        String adminToken = login(admin.getUsername(), TEST_PASS);

        // Plain employee forbidden on all admin config & quarter routes
        mockMvc.perform(get("/api/v1/core/admin/config")
                        .header("Authorization", "Bearer " + empToken))
                .andExpect(status().isForbidden());

        mockMvc.perform(put("/api/v1/core/admin/config")
                        .header("Authorization", "Bearer " + empToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new UpdateSystemConfigsRequest(
                                List.of(new UpdateSystemConfigsRequest.ConfigUpdateEntry(
                                        "coaching.mandatory_cutoff_rounded", "2"))))))
                .andExpect(status().isForbidden());

        // Populate Redis public config cache first
        mockMvc.perform(get("/api/v1/core/config/active")
                        .header("Authorization", "Bearer " + empToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.publicConfig.mandatoryCutoffRounded").value(3));

        // Admin views full config (includes internal mentoring default)
        mockMvc.perform(get("/api/v1/core/admin/config")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.configs[?(@.configKey == 'mentoring.default_max_trainees_per_trainer')]").isNotEmpty())
                .andExpect(jsonPath("$.data.quarters[?(@.label == 'FY 2026/27 · Q2' && @.active == true)]").isNotEmpty());

        // Invalid integer rejected
        mockMvc.perform(put("/api/v1/core/admin/config")
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new UpdateSystemConfigsRequest(
                                List.of(new UpdateSystemConfigsRequest.ConfigUpdateEntry(
                                        "coaching.mandatory_cutoff_rounded", "abc"))))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errorCode").value("INVALID_CONFIG_VALUE"));

        // Out-of-range cutoff (6) rejected
        mockMvc.perform(put("/api/v1/core/admin/config")
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new UpdateSystemConfigsRequest(
                                List.of(new UpdateSystemConfigsRequest.ConfigUpdateEntry(
                                        "coaching.mandatory_cutoff_rounded", "6"))))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errorCode").value("INVALID_CONFIG_VALUE"));

        try {
            // Valid cutoff update -> saved, audited with before/after diff, cache evicted AFTER_COMMIT
            mockMvc.perform(put("/api/v1/core/admin/config")
                            .header("Authorization", "Bearer " + adminToken)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(new UpdateSystemConfigsRequest(
                                    List.of(new UpdateSystemConfigsRequest.ConfigUpdateEntry(
                                            "coaching.mandatory_cutoff_rounded", "2"))))))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.data[?(@.configKey == 'coaching.mandatory_cutoff_rounded')].configValue").value("2"));

            // Active endpoint immediately serves updated value
            mockMvc.perform(get("/api/v1/core/config/active")
                            .header("Authorization", "Bearer " + empToken))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.data.publicConfig.mandatoryCutoffRounded").value(2));

            List<AuditLog> audits = auditLogRepository.findAll().stream()
                    .filter(a -> "SYSTEM_CONFIG_UPDATED".equals(a.getAction())
                            && admin.getId().equals(a.getActorUserId()))
                    .toList();
            assertThat(audits).isNotEmpty();
            assertThat(audits.get(0).getDetailsJson().toString()).contains("previousValue=3", "newValue=2");
        } finally {
            // Restore baseline default
            SystemConfig cutoff = systemConfigRepository.findById("coaching.mandatory_cutoff_rounded").orElseThrow();
            cutoff.setConfigValue("3");
            systemConfigRepository.save(cutoff);
            clearConfigCaches();
        }
    }

    @Test
    void fiscalQuarters_overlapAndLockValidation_andConcurrentActivationMaintainsSingleActive() throws Exception {
        String s = suffix();
        Role configAdminRole = createCustomRole("P4_QuarterAdmin_" + s,
                Set.of("EMPLOYEE_PORTAL_ACCESS", "SYSTEM_CONFIG_MANAGE"));
        User admin = createDirectUser("p4_adm_qtr_" + s, TEST_PASS, false, configAdminRole);
        String adminToken = login(admin.getUsername(), TEST_PASS);

        int maxExistingYear = fiscalQuarterRepository.findAll().stream()
                .mapToInt(fq -> Math.max(fq.getStartDate().getYear(), fq.getEndDate().getYear()))
                .max()
                .orElse(2039);
        int baseYear = Math.max(YEAR_SEQ.getAndAdd(2), maxExistingYear + 2);
        String fyA = baseYear + "/" + String.format("%02d", (baseYear + 1) % 100);
        String fyB = (baseYear + 1) + "/" + String.format("%02d", (baseYear + 2) % 100);

        // 1. Invalid endDate <= startDate rejected
        mockMvc.perform(post("/api/v1/core/admin/fiscal-quarters")
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new CreateFiscalQuarterRequest(
                                fyA, 1, null, LocalDate.of(baseYear, 7, 1), LocalDate.of(baseYear, 7, 1), false))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errorCode").value("INVALID_QUARTER_DATES"));

        // 2. Create two future non-overlapping quarters
        MvcResult resQ1 = mockMvc.perform(post("/api/v1/core/admin/fiscal-quarters")
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new CreateFiscalQuarterRequest(
                                fyA, 1, null, LocalDate.of(baseYear, 6, 1), LocalDate.of(baseYear, 9, 30), false))))
                .andExpect(status().isOk())
                .andReturn();
        Long q1Id = objectMapper.readTree(resQ1.getResponse().getContentAsString()).at("/data/id").asLong();

        MvcResult resQ2 = mockMvc.perform(post("/api/v1/core/admin/fiscal-quarters")
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new CreateFiscalQuarterRequest(
                                fyB, 2, null, LocalDate.of(baseYear, 10, 1), LocalDate.of(baseYear, 12, 31), false))))
                .andExpect(status().isOk())
                .andReturn();
        Long q2Id = objectMapper.readTree(resQ2.getResponse().getContentAsString()).at("/data/id").asLong();

        // 3. Inclusive boundary overlap rejected (startDate == existing endDate)
        mockMvc.perform(post("/api/v1/core/admin/fiscal-quarters")
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new CreateFiscalQuarterRequest(
                                fyA, 3, null, LocalDate.of(baseYear, 9, 30), LocalDate.of(baseYear + 1, 1, 15), false))))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.errorCode").value("QUARTER_DATE_OVERLAP"));

        // 4. Locked quarter rejects date updates
        FiscalQuarter fq1 = fiscalQuarterRepository.findById(q1Id).orElseThrow();
        fq1.setLocked(true);
        fiscalQuarterRepository.save(fq1);

        mockMvc.perform(put("/api/v1/core/admin/fiscal-quarters/" + q1Id)
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new UpdateFiscalQuarterRequest(
                                "Edited Locked Label", LocalDate.of(baseYear, 6, 2), LocalDate.of(baseYear, 9, 29)))))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.errorCode").value("QUARTER_LOCKED"));

        try {
            // 5. Concurrent activation of q1 and q2 leaves strictly ONE active row in DB
            ExecutorService pool = Executors.newFixedThreadPool(2);
            CountDownLatch ready = new CountDownLatch(2);
            CountDownLatch go = new CountDownLatch(1);
            Callable<Integer> actQ1 = () -> {
                ready.countDown();
                go.await(5, TimeUnit.SECONDS);
                return mockMvc.perform(post("/api/v1/core/admin/fiscal-quarters/" + q1Id + "/activate")
                                .header("Authorization", "Bearer " + adminToken))
                        .andReturn().getResponse().getStatus();
            };
            Callable<Integer> actQ2 = () -> {
                ready.countDown();
                go.await(5, TimeUnit.SECONDS);
                return mockMvc.perform(post("/api/v1/core/admin/fiscal-quarters/" + q2Id + "/activate")
                                .header("Authorization", "Bearer " + adminToken))
                        .andReturn().getResponse().getStatus();
            };
            Future<Integer> f1 = pool.submit(actQ1);
            Future<Integer> f2 = pool.submit(actQ2);
            assertThat(ready.await(5, TimeUnit.SECONDS)).isTrue();
            go.countDown();

            assertThat(f1.get(15, TimeUnit.SECONDS)).isEqualTo(200);
            assertThat(f2.get(15, TimeUnit.SECONDS)).isEqualTo(200);
            pool.shutdown();

            List<FiscalQuarter> activeQuarters = fiscalQuarterRepository.findAll().stream()
                    .filter(FiscalQuarter::isActive)
                    .toList();
            assertThat(activeQuarters).hasSize(1);
        } finally {
            ensureQ2Active();
            fiscalQuarterRepository.deleteById(q2Id);
            fiscalQuarterRepository.deleteById(q1Id);
            clearConfigCaches();
        }
    }

    @Test
    void notifications_scoping_idempotentRead_readAll_deepLinkValidation_andOutboxDispatch() throws Exception {
        String s = suffix();
        User userA = createDirectUser("p4_notif_a_" + s, TEST_PASS, false, employeeRole);
        User userB = createDirectUser("p4_notif_b_" + s, TEST_PASS, false, employeeRole);
        User mustChange = createDirectUser("p4_notif_mcp_" + s, TEST_PASS, true, employeeRole);

        String tokenA = login(userA.getUsername(), TEST_PASS);
        String tokenB = login(userB.getUsername(), TEST_PASS);
        String tokenMcp = login(mustChange.getUsername(), TEST_PASS);

        // Forced password-change user blocked from notifications
        mockMvc.perform(get("/api/v1/core/notifications")
                        .header("Authorization", "Bearer " + tokenMcp))
                .andExpect(status().isForbidden());

        // External / phishing deep links rejected
        assertThatThrownBy(() -> notificationService.notify(
                userA.getId(),
                NotificationModule.COACHING,
                "TEST_BAD_LINK",
                "Bad",
                "Message",
                "https://evil.example.com/phish"
        )).isInstanceOf(BusinessException.class)
                .hasMessageContaining("internal portal route");

        // Create 3 notifications for User A and 1 for User B
        var n1 = notificationService.notify(
                userA.getId(), NotificationModule.COACHING, "PMS_IMPORT",
                "First alert", "Body 1", "/coaching/plans/1");
        var n2 = notificationService.notify(
                userA.getId(), NotificationModule.MENTORING, "TRAINER_STATUS",
                "Second alert", "Body 2", "/mentoring/sessions");
        notificationService.notify(
                userA.getId(), NotificationModule.SYSTEM, "QUARTER_CHANGE",
                "Third alert", "Body 3", "/workspace");
        var nB = notificationService.notify(
                userB.getId(), NotificationModule.COACHING, "OTHER_ALERT",
                "B alert", "B body", "/coaching");

        // Pagination caps at page size 1 and still reports total unreadCount = 3
        mockMvc.perform(get("/api/v1/core/notifications")
                        .param("page", "0")
                        .param("size", "2")
                        .header("Authorization", "Bearer " + tokenA))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.items.length()").value(2))
                .andExpect(jsonPath("$.data.totalElements").value(3))
                .andExpect(jsonPath("$.data.unreadCount").value(3));

        // User B cannot mark User A's notification read (returns 404 to prevent existence leak)
        mockMvc.perform(patch("/api/v1/core/notifications/" + n1.id() + "/read")
                        .header("Authorization", "Bearer " + tokenB))
                .andExpect(status().isNotFound());

        // User A marks n1 read -> idempotent timestamp on second PATCH
        MvcResult firstRead = mockMvc.perform(patch("/api/v1/core/notifications/" + n1.id() + "/read")
                        .header("Authorization", "Bearer " + tokenA))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.read").value(true))
                .andExpect(jsonPath("$.data.readAt").isNotEmpty())
                .andReturn();
        String firstReadAt = objectMapper.readTree(firstRead.getResponse().getContentAsString())
                .at("/data/readAt").asText();

        MvcResult secondRead = mockMvc.perform(patch("/api/v1/core/notifications/" + n1.id() + "/read")
                        .header("Authorization", "Bearer " + tokenA))
                .andExpect(status().isOk())
                .andReturn();
        String secondReadAt = objectMapper.readTree(secondRead.getResponse().getContentAsString())
                .at("/data/readAt").asText();
        assertThat(Instant.parse(secondReadAt).truncatedTo(ChronoUnit.MILLIS))
                .isEqualTo(Instant.parse(firstReadAt).truncatedTo(ChronoUnit.MILLIS));

        // User A read-all marks remaining 2 unread rows and leaves User B's row untouched
        mockMvc.perform(post("/api/v1/core/notifications/read-all")
                        .header("Authorization", "Bearer " + tokenA))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.updatedCount").value(2));

        mockMvc.perform(get("/api/v1/core/notifications")
                        .header("Authorization", "Bearer " + tokenA))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.unreadCount").value(0));

        assertThat(notificationRepository.findById(nB.id()).orElseThrow().isRead()).isFalse();

        // Outbox durability: enqueue IN_APP notification -> dispatcher materializes into core.notifications
        Long outboxId = notificationService.enqueueViaOutbox(
                userA.getId(),
                NotificationModule.SYSTEM,
                "OUTBOX_ALERT",
                "Outbox Delivered",
                "Queued safely inside PostgreSQL",
                "/admin",
                NotificationChannel.IN_APP
        );
        outboxDispatcher.dispatchPending();

        NotificationOutbox processed = outboxRepository.findById(outboxId).orElseThrow();
        assertThat(processed.getStatus()).isEqualTo(NotificationOutboxStatus.PROCESSED);
        assertThat(processed.getNotificationId()).isNotNull();
        assertThat(notificationRepository.findById(processed.getNotificationId())).isPresent();
    }

    // --- Helpers ---

    private void ensureQ2Active() {
        jdbcTemplate.update(
                "UPDATE core.fiscal_quarters SET active = FALSE WHERE active = TRUE AND id <> ?",
                seededQ2.getId()
        );
        jdbcTemplate.update(
                "UPDATE core.fiscal_quarters SET active = TRUE WHERE id = ? AND active = FALSE",
                seededQ2.getId()
        );
    }

    private void clearConfigCaches() {
        for (String cacheName : List.of("fiscal_quarters", "system_configs")) {
            Cache c = cacheManager.getCache(cacheName);
            if (c != null) {
                c.clear();
            }
        }
    }

    private Role createCustomRole(String name, Set<String> permissionCodes) {
        Role role = new Role();
        role.setName(name);
        role.setDescription("Phase 4 test role");
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

    private String login(String username, String password) throws Exception {
        MvcResult result = mockMvc.perform(post("/api/v1/core/auth/login")
                        .header("X-Forwarded-For", nextIp())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new LoginRequest(username, password))))
                .andExpect(status().isOk())
                .andReturn();
        return objectMapper.readTree(result.getResponse().getContentAsString())
                .at("/data/accessToken").asText();
    }

    private static String suffix() {
        return UUID.randomUUID().toString().substring(0, 8);
    }

    private static String nextIp() {
        int seq = IP_SEQ.getAndIncrement();
        return "10.204." + (seq / 250) + "." + ((seq % 250) + 1);
    }
}
