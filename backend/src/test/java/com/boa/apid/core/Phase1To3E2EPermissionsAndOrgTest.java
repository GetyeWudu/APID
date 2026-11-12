package com.boa.apid.core;

import com.boa.apid.core.audit.repository.AuditLogRepository;
import com.boa.apid.core.authorization.entity.*;
import com.boa.apid.core.authorization.repository.RoleRepository;
import com.boa.apid.core.authorization.repository.UserRepository;
import com.boa.apid.core.authorization.repository.UserRoleRepository;
import com.boa.apid.core.organization.repository.DepartmentRepository;
import com.boa.apid.core.organization.repository.EmployeeRepository;
import com.boa.apid.core.organization.service.EmployeeQueryService;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.Cookie;
import org.apache.poi.ss.usermodel.*;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import java.io.InputStream;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.*;
import java.util.concurrent.atomic.AtomicInteger;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/**
 * End-to-end verification of the generated 100-employee Bank of Abyssinia Excel workbooks
 * alongside the full RBAC permission system, Redis cache eviction, security, org hierarchy,
 * skills catalog, file storage, and audit trail across Phases 1-3.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class Phase1To3E2EPermissionsAndOrgTest {

    private static final String TEST_PASS = "BoaQa!2026#Secure";
    private static final AtomicInteger IP_SEQ = new AtomicInteger(10);

    @TempDir
    static Path tempStorageDir;

    @DynamicPropertySource
    static void overrideStorage(DynamicPropertyRegistry registry) {
        registry.add("apid.storage.path", () -> tempStorageDir.toAbsolutePath().toString());
    }

    @Autowired private MockMvc mockMvc;
    @Autowired private ObjectMapper objectMapper;
    @Autowired private UserRepository userRepository;
    @Autowired private RoleRepository roleRepository;
    @Autowired private UserRoleRepository userRoleRepository;
    @Autowired private EmployeeRepository employeeRepository;
    @Autowired private DepartmentRepository departmentRepository;
    @Autowired private EmployeeQueryService employeeQueryService;
    @Autowired private AuditLogRepository auditLogRepository;
    @Autowired private PasswordEncoder passwordEncoder;

    private static Path resolveTestDataFile(String filename) {
        Path fromBackend = Path.of("..", "docs", "test-data", filename).normalize();
        if (Files.exists(fromBackend)) {
            return fromBackend;
        }
        Path fromRoot = Path.of("docs", "test-data", filename).normalize();
        if (Files.exists(fromRoot)) {
            return fromRoot;
        }
        throw new IllegalStateException("Test workbook not found: " + filename);
    }

    @Test
    void sampleDirectoryAndPmsWorkbooks_haveValidHierarchyAndRoundedPmsAverages() throws Exception {
        Path hierarchyWb = resolveTestDataFile("BOA_Sample_12Employees_Directory.xlsx");
        Path pms21Wb = resolveTestDataFile("BOA_Sample_36Rows_PMS_Appraisal.xlsx");

        DataFormatter fmt = new DataFormatter(Locale.ROOT);
        Map<String, String> mgrByEmp = new LinkedHashMap<>();

        try (InputStream is = Files.newInputStream(hierarchyWb); Workbook wb = WorkbookFactory.create(is)) {
            Sheet sheet = wb.getSheetAt(0);
            assertThat(sheet.getRow(0).getLastCellNum()).isEqualTo((short) 9);
            assertThat(sheet.getLastRowNum()).isEqualTo(12);

            for (int r = 1; r <= sheet.getLastRowNum(); r++) {
                Row row = sheet.getRow(r);
                String empNo = fmt.formatCellValue(row.getCell(0)).trim();
                String mgrNo = fmt.formatCellValue(row.getCell(8)).trim();
                assertThat(empNo).matches("^00010\\d{3}$");
                assertThat(mgrByEmp).doesNotContainKey(empNo);
                mgrByEmp.put(empNo, mgrNo);
            }
        }

        assertThat(mgrByEmp).hasSize(12);
        assertThat(mgrByEmp.get("00010001")).isEmpty();
        assertThat(mgrByEmp.get("00010005")).isEqualTo("00010004");

        // Verify strict 21-column multi-goal PMS workbook covers the same 12 directory employees with exact goal-score averages
        Map<String, Integer> roundedByEmp = new LinkedHashMap<>();
        Map<String, List<BigDecimal>> goalScoresByEmp = new LinkedHashMap<>();
        Map<String, BigDecimal> overallByEmp = new LinkedHashMap<>();
        int pmsDataRows = 0;
        try (InputStream is = Files.newInputStream(pms21Wb); Workbook wb = WorkbookFactory.create(is)) {
            Sheet sheet = wb.getSheetAt(0);
            assertThat(sheet.getRow(0).getLastCellNum()).isEqualTo((short) 21);
            for (int r = 1; r <= sheet.getLastRowNum(); r++) {
                Row row = sheet.getRow(r);
                pmsDataRows++;
                String empNo = fmt.formatCellValue(row.getCell(0)).trim();
                BigDecimal goalScore = new BigDecimal(fmt.formatCellValue(row.getCell(15)).trim());
                BigDecimal overall = new BigDecimal(fmt.formatCellValue(row.getCell(18)).trim());
                int rounded = Integer.parseInt(fmt.formatCellValue(row.getCell(19)).trim());

                goalScoresByEmp.computeIfAbsent(empNo, k -> new ArrayList<>()).add(goalScore);
                if (overallByEmp.containsKey(empNo)) {
                    assertThat(overallByEmp.get(empNo)).isEqualByComparingTo(overall);
                    assertThat(roundedByEmp.get(empNo)).isEqualTo(rounded);
                } else {
                    overallByEmp.put(empNo, overall);
                    roundedByEmp.put(empNo, rounded);
                }
            }
        }
        assertThat(pmsDataRows).isEqualTo(36);
        assertThat(roundedByEmp.keySet()).containsExactlyInAnyOrderElementsOf(mgrByEmp.keySet());
        for (String empNo : roundedByEmp.keySet()) {
            List<BigDecimal> scores = goalScoresByEmp.get(empNo);
            BigDecimal avg = scores.stream().reduce(BigDecimal.ZERO, BigDecimal::add)
                    .divide(BigDecimal.valueOf(scores.size()), 4, java.math.RoundingMode.HALF_UP);
            assertThat(overallByEmp.get(empNo)).isEqualByComparingTo(avg);
        }
        long mandatoryRoundedLt3 = roundedByEmp.values().stream().filter(v -> v < 3).count();
        long passingRoundedGte3 = roundedByEmp.values().stream().filter(v -> v >= 3).count();
        assertThat(mandatoryRoundedLt3).isEqualTo(4);
        assertThat(passingRoundedGte3).isEqualTo(8);
    }

    @Test
    void fullSystemVerification_directoryExcelImport_pmsRejection_rbacMatrix_cacheEviction_andCoreModules() throws Exception {
        String s = UUID.randomUUID().toString().substring(0, 6);
        Role superAdminRole = roleRepository.findByNameIgnoreCase("Super Admin").orElseThrow();
        Role pmsAdminRole = roleRepository.findByNameIgnoreCase("PMS Admin").orElseThrow();
        Role hrAdminRole = roleRepository.findByNameIgnoreCase("HR Admin").orElseThrow();
        Role employeeRole = roleRepository.findByNameIgnoreCase("Employee").orElseThrow();

        User sa = createDirectUser("e2e_sa_" + s, superAdminRole);
        String saJwt = login(sa.getUsername(), TEST_PASS);

        // 1. Upload & Commit 12-employee Bank of Abyssinia Standard Directory Workbook
        Path hierarchyWb = resolveTestDataFile("BOA_Sample_12Employees_Directory.xlsx");
        MockMultipartFile wb1Part = new MockMultipartFile(
                "file", "BOA_Sample_12Employees_Directory.xlsx",
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                Files.readAllBytes(hierarchyWb)
        );
        MvcResult p1Res = mockMvc.perform(multipart("/api/v1/core/admin/employees/import/preview")
                        .file(wb1Part)
                        .header("Authorization", "Bearer " + saJwt))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.fileFormat").value("XLSX"))
                .andExpect(jsonPath("$.data.detectedSchema").value("HIERARCHY_STANDARD"))
                .andExpect(jsonPath("$.data.managerColumnDetected").value(true))
                .andExpect(jsonPath("$.data.totalSourceRows").value(12))
                .andExpect(jsonPath("$.data.uniqueEmployees").value(12))
                .andExpect(jsonPath("$.data.duplicateRowsCollapsed").value(0))
                .andExpect(jsonPath("$.data.errorRows").value(0))
                .andExpect(jsonPath("$.data.warningRows").value(0))
                .andReturn();
        long batch1Id = objectMapper.readTree(p1Res.getResponse().getContentAsString()).at("/data/batchId").asLong();

        mockMvc.perform(post("/api/v1/core/admin/employees/import/batches/" + batch1Id + "/commit")
                        .header("Authorization", "Bearer " + saJwt))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.managersLinked").value(11));

        // Verify multi-tier hierarchy queries & Cycle Guard
        var ceo = employeeQueryService.findByEmployeeNumber("00010001").orElseThrow();
        mockMvc.perform(get("/api/v1/core/employees/" + ceo.id() + "/direct-reports")
                        .header("Authorization", "Bearer " + saJwt))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.length()").value(3));

        var branchOfficer = employeeQueryService.findByEmployeeNumber("00010005").orElseThrow();
        assertThat(branchOfficer.managerEmployeeNumber()).isEqualTo("00010004");
        String cyclePayload = objectMapper.writeValueAsString(Map.of(
                "employeeNumber", ceo.employeeNumber(),
                "fullName", ceo.fullName(),
                "email", ceo.email(),
                "gender", ceo.gender(),
                "departmentId", ceo.departmentId(),
                "job", ceo.job(),
                "position", ceo.position(),
                "managerId", branchOfficer.id(),
                "employmentStatus", "ACTIVE"
        ));
        mockMvc.perform(put("/api/v1/core/admin/employees/" + ceo.id())
                        .header("Authorization", "Bearer " + saJwt)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(cyclePayload))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errorCode").value("MANAGER_CYCLE"));

        // 2. Uploading a 21-column PMS Appraisal workbook into Phase 3 Org Import must be cleanly rejected
        Path pms21Wb = resolveTestDataFile("BOA_Sample_36Rows_PMS_Appraisal.xlsx");
        MockMultipartFile wb2Part = new MockMultipartFile(
                "file", "BOA_Sample_36Rows_PMS_Appraisal.xlsx",
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                Files.readAllBytes(pms21Wb)
        );
        mockMvc.perform(multipart("/api/v1/core/admin/employees/import/preview")
                        .file(wb2Part)
                        .header("Authorization", "Bearer " + saJwt))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errorCode").value("PMS_FILE_NOT_ALLOWED_IN_ORG_IMPORT"));

        assertThat(employeeQueryService.findByEmployeeNumber("00010005").orElseThrow().managerEmployeeNumber())
                .isEqualTo("00010004");

        // 3. Create custom dynamic role + onboard PMS Admin, HR Admin, Employee, and Custom Role users
        MvcResult customRoleRes = mockMvc.perform(post("/api/v1/core/admin/roles")
                        .header("Authorization", "Bearer " + saJwt)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "name", "BOA Coordinator " + s,
                                "description", "Dynamic RBAC cache eviction test role",
                                "permissionCodes", List.of("EMPLOYEE_PORTAL_ACCESS")
                        ))))
                .andExpect(status().isOk())
                .andReturn();
        long customRoleId = objectMapper.readTree(customRoleRes.getResponse().getContentAsString()).at("/data/id").asLong();

        CreatedUser pmsUser = onboardUserViaApi(saJwt, "e2e_pms_" + s, pmsAdminRole.getId());
        CreatedUser hrUser = onboardUserViaApi(saJwt, "e2e_hr_" + s, hrAdminRole.getId());
        CreatedUser empUser = onboardUserViaApi(saJwt, "e2e_emp_" + s, employeeRole.getId());
        CreatedUser dynUser = onboardUserViaApi(saJwt, "e2e_dyn_" + s, customRoleId);

        // 4. Built-in Role Permission Matrix Enforcement
        mockMvc.perform(get("/api/v1/core/admin/permissions").header("Authorization", "Bearer " + saJwt))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.length()").value(19));

        // PMS Admin
        mockMvc.perform(get("/api/v1/core/employees").header("Authorization", "Bearer " + pmsUser.jwt)).andExpect(status().isOk());
        mockMvc.perform(get("/api/v1/core/departments").header("Authorization", "Bearer " + pmsUser.jwt)).andExpect(status().isOk());
        mockMvc.perform(get("/api/v1/core/admin/users").header("Authorization", "Bearer " + pmsUser.jwt)).andExpect(status().isForbidden());
        mockMvc.perform(get("/api/v1/core/admin/roles").header("Authorization", "Bearer " + pmsUser.jwt)).andExpect(status().isForbidden());
        mockMvc.perform(get("/api/v1/core/admin/audit-logs").header("Authorization", "Bearer " + pmsUser.jwt)).andExpect(status().isForbidden());
        mockMvc.perform(get("/api/v1/core/admin/skills").header("Authorization", "Bearer " + pmsUser.jwt)).andExpect(status().isForbidden());

        // HR Admin
        mockMvc.perform(get("/api/v1/core/admin/skills").header("Authorization", "Bearer " + hrUser.jwt)).andExpect(status().isOk());
        mockMvc.perform(get("/api/v1/core/employees").header("Authorization", "Bearer " + hrUser.jwt)).andExpect(status().isOk());
        mockMvc.perform(get("/api/v1/core/admin/users").header("Authorization", "Bearer " + hrUser.jwt)).andExpect(status().isForbidden());
        mockMvc.perform(get("/api/v1/core/admin/audit-logs").header("Authorization", "Bearer " + hrUser.jwt)).andExpect(status().isForbidden());
        mockMvc.perform(post("/api/v1/core/admin/departments").header("Authorization", "Bearer " + hrUser.jwt)
                .contentType(MediaType.APPLICATION_JSON).content("{\"name\":\"Unauthorized Dept\"}"))
                .andExpect(status().isForbidden());

        // Employee
        mockMvc.perform(get("/api/v1/core/employees").header("Authorization", "Bearer " + empUser.jwt)).andExpect(status().isOk());
        mockMvc.perform(get("/api/v1/core/skills").header("Authorization", "Bearer " + empUser.jwt)).andExpect(status().isOk());
        mockMvc.perform(get("/api/v1/core/admin/users").header("Authorization", "Bearer " + empUser.jwt)).andExpect(status().isForbidden());
        mockMvc.perform(get("/api/v1/core/admin/roles").header("Authorization", "Bearer " + empUser.jwt)).andExpect(status().isForbidden());
        mockMvc.perform(get("/api/v1/core/admin/skills").header("Authorization", "Bearer " + empUser.jwt)).andExpect(status().isForbidden());
        mockMvc.perform(get("/api/v1/core/admin/audit-logs").header("Authorization", "Bearer " + empUser.jwt)).andExpect(status().isForbidden());
        mockMvc.perform(get("/api/v1/core/admin/employees/unlinked-users").header("Authorization", "Bearer " + empUser.jwt)).andExpect(status().isForbidden());

        // 5. Dynamic Role Permission Grant/Revoke + Immediate Redis Cache Eviction (same JWT!)
        mockMvc.perform(get("/api/v1/core/admin/employees/unlinked-users").header("Authorization", "Bearer " + dynUser.jwt))
                .andExpect(status().isForbidden());

        mockMvc.perform(put("/api/v1/core/admin/roles/" + customRoleId + "/permissions")
                        .header("Authorization", "Bearer " + saJwt)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("permissionCodes",
                                List.of("EMPLOYEE_PORTAL_ACCESS", "HIERARCHY_MANAGE")))))
                .andExpect(status().isOk());

        mockMvc.perform(get("/api/v1/core/admin/employees/unlinked-users").header("Authorization", "Bearer " + dynUser.jwt))
                .andExpect(status().isOk());

        mockMvc.perform(put("/api/v1/core/admin/roles/" + customRoleId + "/permissions")
                        .header("Authorization", "Bearer " + saJwt)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("permissionCodes",
                                List.of("EMPLOYEE_PORTAL_ACCESS")))))
                .andExpect(status().isOk());

        mockMvc.perform(get("/api/v1/core/admin/employees/unlinked-users").header("Authorization", "Bearer " + dynUser.jwt))
                .andExpect(status().isForbidden());

        // 6. Super Admin System-Protected Guard & Anti-Privilege-Escalation Guard
        mockMvc.perform(put("/api/v1/core/admin/roles/" + superAdminRole.getId() + "/permissions")
                        .header("Authorization", "Bearer " + saJwt)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"permissionCodes\":[\"USER_MANAGE\"]}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errorCode").value("PROTECTED_ROLE_PERMISSION"));

        // Grant ROLE_PERMISSION_MANAGE (without USER_MANAGE) to custom role -> attempt to grant USER_MANAGE -> blocked 403 PRIVILEGE_ESCALATION_DENIED
        mockMvc.perform(put("/api/v1/core/admin/roles/" + customRoleId + "/permissions")
                        .header("Authorization", "Bearer " + saJwt)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("permissionCodes",
                                List.of("EMPLOYEE_PORTAL_ACCESS", "ROLE_PERMISSION_MANAGE")))))
                .andExpect(status().isOk());
        mockMvc.perform(post("/api/v1/core/admin/roles")
                        .header("Authorization", "Bearer " + dynUser.jwt)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "name", "Escalated " + s,
                                "description", "Should fail",
                                "permissionCodes", List.of("USER_MANAGE")
                        ))))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.errorCode").value("PRIVILEGE_ESCALATION_DENIED"));

        // 7. Explicit Employee-User Link/Unlink + /employees/me + Direct Reports
        var branchMgr = employeeQueryService.findByEmployeeNumber("00010004").orElseThrow();
        mockMvc.perform(post("/api/v1/core/admin/employees/" + branchMgr.id() + "/link-user")
                        .header("Authorization", "Bearer " + saJwt)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"userId\":" + empUser.userId + "}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.username").value(empUser.username));

        mockMvc.perform(get("/api/v1/core/employees/me").header("Authorization", "Bearer " + empUser.jwt))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.employeeNumber").value("00010004"));

        mockMvc.perform(delete("/api/v1/core/admin/employees/" + branchMgr.id() + "/link-user")
                        .header("Authorization", "Bearer " + saJwt))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.userId").isEmpty());

        // 8. Skills CRUD (HR Admin) + File Storage Upload/Download/Delete (Employee)
        MvcResult skillCreate = mockMvc.perform(post("/api/v1/core/admin/skills")
                        .header("Authorization", "Bearer " + hrUser.jwt)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "name", "Trade Finance & LC Operations " + s,
                                "category", "Banking Operations",
                                "description", "E2E skill test"
                        ))))
                .andExpect(status().isOk())
                .andReturn();
        long skillId = objectMapper.readTree(skillCreate.getResponse().getContentAsString()).at("/data/id").asLong();
        mockMvc.perform(patch("/api/v1/core/admin/skills/" + skillId + "/status")
                        .header("Authorization", "Bearer " + hrUser.jwt)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"active\":false}"))
                .andExpect(status().isOk());

        MockMultipartFile pdfFile = new MockMultipartFile(
                "file", "e2e-cert.pdf", "application/pdf",
                "%PDF-1.4\n1 0 obj << /Type /Catalog >> endobj\n%%EOF\n".getBytes(StandardCharsets.US_ASCII)
        );
        MvcResult fUp = mockMvc.perform(multipart("/api/v1/core/files")
                        .file(pdfFile)
                        .param("purpose", "TRAINER_CERT")
                        .header("Authorization", "Bearer " + empUser.jwt))
                .andExpect(status().isOk())
                .andReturn();
        long fileId = objectMapper.readTree(fUp.getResponse().getContentAsString()).at("/data/id").asLong();

        mockMvc.perform(get("/api/v1/core/files/" + fileId + "/download")
                        .header("Authorization", "Bearer " + empUser.jwt))
                .andExpect(status().isOk())
                .andExpect(header().string("X-Content-Type-Options", "nosniff"));
        mockMvc.perform(delete("/api/v1/core/files/" + fileId)
                        .header("Authorization", "Bearer " + empUser.jwt))
                .andExpect(status().isOk());

        // 9. Lockout + Unlock + Refresh Rotation/Reuse + CSRF check
        for (int i = 0; i < 5; i++) {
            mockMvc.perform(post("/api/v1/core/auth/login")
                            .header("X-Forwarded-For", "10.88.0." + IP_SEQ.incrementAndGet())
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(Map.of(
                                    "username", empUser.username, "password", "Wrong!Pass123"))))
                    .andExpect(status().isUnauthorized());
        }
        mockMvc.perform(post("/api/v1/core/auth/login")
                        .header("X-Forwarded-For", "10.88.0." + IP_SEQ.incrementAndGet())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "username", empUser.username, "password", empUser.password))))
                .andExpect(status().isUnauthorized());

        mockMvc.perform(post("/api/v1/core/admin/users/" + empUser.userId + "/unlock")
                        .header("Authorization", "Bearer " + saJwt))
                .andExpect(status().isOk());

        MvcResult reLoginRes = mockMvc.perform(post("/api/v1/core/auth/login")
                        .header("X-Forwarded-For", "10.88.0." + IP_SEQ.incrementAndGet())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "username", empUser.username, "password", empUser.password))))
                .andExpect(status().isOk())
                .andReturn();
        Cookie rCookie1 = reLoginRes.getResponse().getCookie("apid_refresh_token");
        assertThat(rCookie1).isNotNull();

        mockMvc.perform(post("/api/v1/core/auth/refresh").with(csrf()).cookie(rCookie1))
                .andExpect(status().isOk());
        mockMvc.perform(post("/api/v1/core/auth/refresh").with(csrf()).cookie(rCookie1))
                .andExpect(status().isUnauthorized());

        // 10. Audit Log Verification
        mockMvc.perform(get("/api/v1/core/admin/audit-logs?size=50")
                        .header("Authorization", "Bearer " + saJwt))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.totalElements").value(org.hamcrest.Matchers.greaterThan(5)));

        // 11. Backend Dashboard Summary Permission-Scoping & Direct-Reports IDOR Guard
        mockMvc.perform(get("/api/v1/core/admin/dashboard/summary")
                        .header("Authorization", "Bearer " + saJwt))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.users.total").value(org.hamcrest.Matchers.greaterThanOrEqualTo(5)))
                .andExpect(jsonPath("$.data.employees.total").value(org.hamcrest.Matchers.greaterThanOrEqualTo(12)))
                .andExpect(jsonPath("$.data.departments.total").value(org.hamcrest.Matchers.greaterThanOrEqualTo(8)))
                .andExpect(jsonPath("$.data.roles.length()").value(org.hamcrest.Matchers.greaterThanOrEqualTo(5)))
                .andExpect(jsonPath("$.data.totalCatalogPermissions").value(19))
                .andExpect(jsonPath("$.data.redisMonitoringAvailable").value(false));

        // HR Admin holds SKILL_MANAGE -> summary returns ONLY skills, keeping users/employees/roles/audit24h null
        mockMvc.perform(get("/api/v1/core/admin/dashboard/summary")
                        .header("Authorization", "Bearer " + hrUser.jwt))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.skills.total").value(org.hamcrest.Matchers.greaterThanOrEqualTo(6)))
                .andExpect(jsonPath("$.data.users").isEmpty())
                .andExpect(jsonPath("$.data.employees").isEmpty())
                .andExpect(jsonPath("$.data.audit24h").isEmpty());

        mockMvc.perform(get("/api/v1/core/admin/dashboard/summary")
                        .header("Authorization", "Bearer " + empUser.jwt))
                .andExpect(status().isForbidden());

        // Link empUser to Branch Manager 00010004 (5 reports) -> /employees/me/direct-reports works, snooping CEO reports fails 403
        mockMvc.perform(post("/api/v1/core/admin/employees/" + branchMgr.id() + "/link-user")
                        .header("Authorization", "Bearer " + saJwt)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"userId\":" + empUser.userId + "}"))
                .andExpect(status().isOk());

        mockMvc.perform(get("/api/v1/core/employees/me/direct-reports")
                        .header("Authorization", "Bearer " + empUser.jwt))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.length()").value(5));

        mockMvc.perform(get("/api/v1/core/employees/" + branchMgr.id() + "/direct-reports")
                        .header("Authorization", "Bearer " + empUser.jwt))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.length()").value(5));

        mockMvc.perform(get("/api/v1/core/employees/" + ceo.id() + "/direct-reports")
                        .header("Authorization", "Bearer " + empUser.jwt))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.errorCode").value("ACCESS_DENIED"));

        mockMvc.perform(get("/api/v1/core/employees/" + branchOfficer.id() + "/manager")
                        .header("Authorization", "Bearer " + empUser.jwt))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.errorCode").value("ACCESS_DENIED"));
    }

    record CreatedUser(long userId, String username, String password, String jwt) {}

    private CreatedUser onboardUserViaApi(String saJwt, String username, long roleId) throws Exception {
        String tempPass = "TempBoa!2026#1";
        MvcResult createRes = mockMvc.perform(post("/api/v1/core/admin/users")
                        .header("Authorization", "Bearer " + saJwt)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "username", username,
                                "temporaryPassword", tempPass,
                                "roleIds", List.of(roleId)
                        ))))
                .andExpect(status().isOk())
                .andReturn();
        long userId = objectMapper.readTree(createRes.getResponse().getContentAsString()).at("/data/user/id").asLong();

        // First login enforces mustChangePassword (authorities stripped -> 403 on protected endpoints, /auth/me -> mustChangePassword=true)
        String firstJwt = login(username, tempPass);
        mockMvc.perform(get("/api/v1/core/auth/me").header("Authorization", "Bearer " + firstJwt))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.mustChangePassword").value(true));
        mockMvc.perform(get("/api/v1/core/employees").header("Authorization", "Bearer " + firstJwt))
                .andExpect(status().isForbidden());

        mockMvc.perform(post("/api/v1/core/auth/change-password")
                        .header("Authorization", "Bearer " + firstJwt)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "currentPassword", tempPass,
                                "newPassword", TEST_PASS
                        ))))
                .andExpect(status().isOk());

        return new CreatedUser(userId, username, TEST_PASS, login(username, TEST_PASS));
    }

    private User createDirectUser(String username, Role role) {
        User u = new User();
        u.setUsername(username);
        u.setPasswordHash(passwordEncoder.encode(TEST_PASS));
        u.setAuthProvider(AuthProvider.LOCAL);
        u.setStatus(UserStatus.ACTIVE);
        u.setMustChangePassword(false);
        u = userRepository.saveAndFlush(u);
        UserRole ur = new UserRole();
        ur.setUser(u);
        ur.setRole(role);
        userRoleRepository.saveAndFlush(ur);
        return u;
    }

    private String login(String username, String password) throws Exception {
        MvcResult res = mockMvc.perform(post("/api/v1/core/auth/login")
                        .header("X-Forwarded-For", "10.88.0." + IP_SEQ.incrementAndGet())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "username", username,
                                "password", password
                        ))))
                .andExpect(status().isOk())
                .andReturn();
        return objectMapper.readTree(res.getResponse().getContentAsString()).at("/data/accessToken").asText();
    }
}
