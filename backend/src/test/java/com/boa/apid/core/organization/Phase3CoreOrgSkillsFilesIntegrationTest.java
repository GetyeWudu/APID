package com.boa.apid.core.organization;

import com.boa.apid.core.auth.controller.AuthController;
import com.boa.apid.core.auth.dto.LoginRequest;
import com.boa.apid.core.authorization.entity.*;
import com.boa.apid.core.authorization.repository.PermissionRepository;
import com.boa.apid.core.authorization.repository.RoleRepository;
import com.boa.apid.core.authorization.repository.UserRepository;
import com.boa.apid.core.authorization.repository.UserRoleRepository;
import com.boa.apid.core.organization.dto.*;
import com.boa.apid.core.organization.entity.EmploymentStatus;
import com.boa.apid.core.organization.service.EmployeeQueryService;
import com.boa.apid.core.skills.dto.CreateSkillRequest;
import com.boa.apid.core.skills.dto.UpdateSkillRequest;
import com.boa.apid.core.skills.dto.UpdateSkillStatusRequest;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.cache.Cache;
import org.springframework.cache.CacheManager;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import java.nio.charset.StandardCharsets;
import java.nio.file.Path;
import java.util.LinkedHashSet;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicInteger;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class Phase3CoreOrgSkillsFilesIntegrationTest {

    private static final String TEST_PASS = "TestPass!2026#Secure";
    private static final AtomicInteger IP_SEQ = new AtomicInteger(100);

    @TempDir
    static Path tempStorageDir;

    @DynamicPropertySource
    static void overrideStoragePath(DynamicPropertyRegistry registry) {
        registry.add("apid.storage.path", () -> tempStorageDir.toAbsolutePath().toString());
    }

    @Autowired private MockMvc mockMvc;
    @Autowired private ObjectMapper objectMapper;
    @Autowired private UserRepository userRepository;
    @Autowired private RoleRepository roleRepository;
    @Autowired private PermissionRepository permissionRepository;
    @Autowired private UserRoleRepository userRoleRepository;
    @Autowired private PasswordEncoder passwordEncoder;
    @Autowired private CacheManager cacheManager;
    @Autowired private EmployeeQueryService employeeQueryService;

    private Role superAdminRole;
    private Role employeeRole;

    @BeforeEach
    void loadRoles() {
        superAdminRole = roleRepository.findByNameIgnoreCase("Super Admin").orElseThrow();
        employeeRole = roleRepository.findByNameIgnoreCase("Employee").orElseThrow();
    }

    @Test
    void fileStorage_uploadDownloadAuth_magicByteMismatch_softDelete() throws Exception {
        String s = suffix();
        Role reviewerRole = createCustomRole("P3_Reviewer_" + s,
                Set.of("EMPLOYEE_PORTAL_ACCESS", "TRAINER_APPLICATION_REVIEW"));

        User uploader = createDirectUser("p3_uploader_" + s, TEST_PASS, employeeRole);
        User otherEmployee = createDirectUser("p3_other_" + s, TEST_PASS, employeeRole);
        User reviewer = createDirectUser("p3_reviewer_" + s, TEST_PASS, reviewerRole);

        String uploaderToken = login(uploader.getUsername(), TEST_PASS);
        String otherToken = login(otherEmployee.getUsername(), TEST_PASS);
        String reviewerToken = login(reviewer.getUsername(), TEST_PASS);

        byte[] validPdf = "%PDF-1.4\n%BOA Certificate\n1 0 obj\n<<>>\nendobj\n".getBytes(StandardCharsets.UTF_8);
        MockMultipartFile pdfPart = new MockMultipartFile(
                "file", "trainer-cert.pdf", "application/pdf", validPdf
        );

        MvcResult uploadResult = mockMvc.perform(multipart("/api/v1/core/files")
                        .file(pdfPart)
                        .param("purpose", "TRAINER_CERT")
                        .header("Authorization", "Bearer " + uploaderToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.module").value("MENTORING"))
                .andExpect(jsonPath("$.data.purpose").value("TRAINER_CERT"))
                .andExpect(jsonPath("$.data.sha256Hash").isNotEmpty())
                .andReturn();

        Long fileId = objectMapper.readTree(uploadResult.getResponse().getContentAsString())
                .at("/data/id").asLong();

        // Another plain employee cannot download uploader's certificate
        mockMvc.perform(get("/api/v1/core/files/" + fileId + "/download")
                        .header("Authorization", "Bearer " + otherToken))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.errorCode").value("ACCESS_DENIED"));

        // Reviewer with TRAINER_APPLICATION_REVIEW can download
        MvcResult downloadResult = mockMvc.perform(get("/api/v1/core/files/" + fileId + "/download")
                        .header("Authorization", "Bearer " + reviewerToken))
                .andExpect(status().isOk())
                .andExpect(header().string("X-Content-Type-Options", "nosniff"))
                .andReturn();
        assertThat(downloadResult.getResponse().getContentAsByteArray()).isEqualTo(validPdf);

        // Magic-byte mismatch (.pdf without %PDF header) rejected
        MockMultipartFile spoofedPdf = new MockMultipartFile(
                "file", "spoofed.pdf", "application/pdf", "MZ_FAKE_EXECUTABLE".getBytes(StandardCharsets.UTF_8)
        );
        mockMvc.perform(multipart("/api/v1/core/files")
                        .file(spoofedPdf)
                        .param("purpose", "TRAINER_CERT")
                        .header("Authorization", "Bearer " + uploaderToken))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errorCode").value("FILE_SIGNATURE_MISMATCH"));

        // Owner soft-deletes file -> subsequent download returns 404
        mockMvc.perform(delete("/api/v1/core/files/" + fileId)
                        .header("Authorization", "Bearer " + uploaderToken))
                .andExpect(status().isOk());

        mockMvc.perform(get("/api/v1/core/files/" + fileId + "/download")
                        .header("Authorization", "Bearer " + reviewerToken))
                .andExpect(status().isNotFound());
    }

    @Test
    void skillsCatalog_crud_duplicateRejected_redisCacheHitAndEviction() throws Exception {
        String s = suffix();
        Role skillAdminRole = createCustomRole("P3_SkillAdmin_" + s,
                Set.of("EMPLOYEE_PORTAL_ACCESS", "SKILL_MANAGE"));
        User employee = createDirectUser("p3_emp_skill_" + s, TEST_PASS, employeeRole);
        User admin = createDirectUser("p3_adm_skill_" + s, TEST_PASS, skillAdminRole);

        String empToken = login(employee.getUsername(), TEST_PASS);
        String adminToken = login(admin.getUsername(), TEST_PASS);

        // Clear skills_catalog before verifying population + deserialization
        Cache skillsCache = cacheManager.getCache("skills_catalog");
        assertThat(skillsCache).isNotNull();
        skillsCache.clear();

        // 1. Employee lists active skills -> populates Redis skills_catalog::active
        mockMvc.perform(get("/api/v1/core/skills")
                        .header("Authorization", "Bearer " + empToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[?(@.name == 'Credit Risk & Loan Assessment')]").isNotEmpty());

        assertThat(skillsCache.get("active")).isNotNull();

        // 2. Second request hits Redis (verifies non-final SkillDto deserialization works cleanly)
        mockMvc.perform(get("/api/v1/core/skills")
                        .param("category", "Banking Operations")
                        .header("Authorization", "Bearer " + empToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[?(@.name == 'Credit Risk & Loan Assessment')]").isNotEmpty());

        // 3. Employee cannot create skills
        String newSkillName = "IFRS 9 Expected Loss " + s;
        mockMvc.perform(post("/api/v1/core/admin/skills")
                        .header("Authorization", "Bearer " + empToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(
                                new CreateSkillRequest(newSkillName, "Finance", "Banking impairment modeling"))))
                .andExpect(status().isForbidden());

        // 4. Skill Admin creates skill -> evicts cache -> active list immediately reflects new skill
        MvcResult createRes = mockMvc.perform(post("/api/v1/core/admin/skills")
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(
                                new CreateSkillRequest(newSkillName, "Finance", "Banking impairment modeling"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.name").value(newSkillName))
                .andReturn();

        Long skillId = objectMapper.readTree(createRes.getResponse().getContentAsString()).at("/data/id").asLong();
        assertThat(skillsCache.get("active")).isNull();

        mockMvc.perform(get("/api/v1/core/skills")
                        .param("search", newSkillName)
                        .header("Authorization", "Bearer " + empToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.length()").value(1));

        // 5. Case-insensitive duplicate rejected with 409
        mockMvc.perform(post("/api/v1/core/admin/skills")
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(
                                new CreateSkillRequest(newSkillName.toUpperCase(Locale.ROOT), "Finance", null))))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.errorCode").value("SKILL_ALREADY_EXISTS"));

        // 6. Update & deactivate skill
        String updatedName = newSkillName + " Updated";
        mockMvc.perform(put("/api/v1/core/admin/skills/" + skillId)
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(
                                new UpdateSkillRequest(updatedName, "Risk & Finance", "Updated description"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.name").value(updatedName));

        mockMvc.perform(patch("/api/v1/core/admin/skills/" + skillId + "/status")
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new UpdateSkillStatusRequest(false))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.active").value(false));

        // Active endpoint no longer returns deactivated skill, while admin endpoint does
        mockMvc.perform(get("/api/v1/core/skills")
                        .param("search", updatedName)
                        .header("Authorization", "Bearer " + empToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.length()").value(0));

        mockMvc.perform(get("/api/v1/core/admin/skills")
                        .param("search", updatedName)
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.length()").value(1))
                .andExpect(jsonPath("$.data[0].active").value(false));
    }

    @Test
    void organization_departmentsEmployees_cyclesRejected_andQueryApi() throws Exception {
        String s = suffix();
        User sa = createDirectUser("p3_sa_org_" + s, TEST_PASS, superAdminRole);
        User mgrUser = createDirectUser("p3_mgr_" + s, TEST_PASS, employeeRole);
        User staffUser = createDirectUser("p3_staff_" + s, TEST_PASS, employeeRole);

        String saToken = login(sa.getUsername(), TEST_PASS);
        String staffToken = login(staffUser.getUsername(), TEST_PASS);

        // 1. Create parent & child departments, populate org_departments cache, verify cycle check
        MvcResult rootDeptRes = mockMvc.perform(post("/api/v1/core/admin/departments")
                        .header("Authorization", "Bearer " + saToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(
                                new CreateDepartmentRequest("DIR-" + s, "Operations Directorate " + s, null, null))))
                .andExpect(status().isOk())
                .andReturn();
        Long rootDeptId = objectMapper.readTree(rootDeptRes.getResponse().getContentAsString()).at("/data/id").asLong();

        MvcResult childDeptRes = mockMvc.perform(post("/api/v1/core/admin/departments")
                        .header("Authorization", "Bearer " + saToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(
                                new CreateDepartmentRequest("DIV-" + s, "Branch Banking " + s, rootDeptId, null))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.parentDepartmentId").value(rootDeptId))
                .andReturn();
        Long childDeptId = objectMapper.readTree(childDeptRes.getResponse().getContentAsString()).at("/data/id").asLong();

        mockMvc.perform(put("/api/v1/core/admin/departments/" + rootDeptId)
                        .header("Authorization", "Bearer " + saToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(
                                new UpdateDepartmentRequest("DIR-" + s, "Operations Directorate " + s, childDeptId, null, true))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errorCode").value("DEPARTMENT_CYCLE"));

        // 2. Create manager & subordinate employees
        String mgrEmpNo = "BOA-M-" + s;
        String staffEmpNo = "BOA-E-" + s;
        MvcResult mgrRes = mockMvc.perform(post("/api/v1/core/admin/employees")
                        .header("Authorization", "Bearer " + saToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new CreateEmployeeRequest(
                                mgrUser.getId(), mgrEmpNo, "Kebede Tadesse " + s,
                                "kebede." + s + "@bankofabyssinia.com", "Male", rootDeptId,
                                "Director", "Director Operations", null, EmploymentStatus.ACTIVE
                        ))))
                .andExpect(status().isOk())
                .andReturn();
        Long mgrEmpId = objectMapper.readTree(mgrRes.getResponse().getContentAsString()).at("/data/id").asLong();

        MvcResult staffRes = mockMvc.perform(post("/api/v1/core/admin/employees")
                        .header("Authorization", "Bearer " + saToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new CreateEmployeeRequest(
                                staffUser.getId(), staffEmpNo, "Alex Bekele " + s,
                                "alex." + s + "@bankofabyssinia.com", "Male", childDeptId,
                                "Officer", "Branch Officer", mgrEmpId, EmploymentStatus.ACTIVE
                        ))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.managerId").value(mgrEmpId))
                .andReturn();
        Long staffEmpId = objectMapper.readTree(staffRes.getResponse().getContentAsString()).at("/data/id").asLong();

        // 3. Employee /me, /manager, /direct-reports endpoints + cross-module EmployeeQueryService
        mockMvc.perform(get("/api/v1/core/employees/me")
                        .header("Authorization", "Bearer " + staffToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.employeeNumber").value(staffEmpNo))
                .andExpect(jsonPath("$.data.departmentName").value("Branch Banking " + s));

        mockMvc.perform(get("/api/v1/core/employees/" + staffEmpId + "/manager")
                        .header("Authorization", "Bearer " + staffToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.id").value(mgrEmpId));

        mockMvc.perform(get("/api/v1/core/employees/" + mgrEmpId + "/direct-reports")
                        .header("Authorization", "Bearer " + saToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[?(@.id == " + staffEmpId + ")]").isNotEmpty());

        assertThat(employeeQueryService.isDirectManager(mgrEmpId, staffEmpId)).isTrue();
        assertThat(employeeQueryService.isDirectManager(staffEmpId, mgrEmpId)).isFalse();

        // 4. Reject circular reporting (manager reporting to subordinate) & duplicate user link
        mockMvc.perform(put("/api/v1/core/admin/employees/" + mgrEmpId)
                        .header("Authorization", "Bearer " + saToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new UpdateEmployeeRequest(
                                mgrUser.getId(), mgrEmpNo, "Kebede Tadesse " + s,
                                "kebede." + s + "@bankofabyssinia.com", "Male", rootDeptId,
                                "Director", "Director Operations", staffEmpId, EmploymentStatus.ACTIVE
                        ))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errorCode").value("MANAGER_CYCLE"));

        mockMvc.perform(post("/api/v1/core/admin/employees")
                        .header("Authorization", "Bearer " + saToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new CreateEmployeeRequest(
                                staffUser.getId(), "BOA-DUP-" + s, "Another Person",
                                "another." + s + "@bankofabyssinia.com", "Female", childDeptId,
                                "Analyst", "Analyst", null, EmploymentStatus.ACTIVE
                        ))))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.errorCode").value("USER_ALREADY_LINKED"));
    }

    @Test
    void hierarchyCsvImport_twoPassResolvesManagersAndDepartments_andRejectsInvalidCommit() throws Exception {
        String s = suffix();
        User sa = createDirectUser("p3_sa_csv_" + s, TEST_PASS, superAdminRole);
        String saToken = login(sa.getUsername(), TEST_PASS);

        String empAlex = "CSV-ALEX-" + s;
        String empKebede = "CSV-KEBEDE-" + s;
        String empAbebe = "CSV-ABEBE-" + s;

        // Subordinate rows intentionally precede their managers to verify 2-pass import
        String csv = String.join("\n",
                "EmployeeNumber,FullName,Email,Gender,ParentDepartment,Department,Job,Position,ManagerEmployeeNumber",
                empAlex + ",Alex Tesfaye,alex.csv." + s + "@boa.et,Male,Technology " + s + ",Platform Engineering " + s + ",Software Engineer,Senior Engineer," + empKebede,
                empKebede + ",Kebede Hailu,kebede.csv." + s + "@boa.et,Male,Technology " + s + ",Platform Engineering " + s + ",Engineering Manager,Engineering Lead," + empAbebe,
                empAbebe + ",Abebe Bikila,abebe.csv." + s + "@boa.et,Male,Executive " + s + ",Executive " + s + ",Chief Technology Officer,CTO,"
        );

        MockMultipartFile csvPart = new MockMultipartFile(
                "file", "boa-hierarchy.csv", "text/csv", csv.getBytes(StandardCharsets.UTF_8)
        );

        MvcResult previewRes = mockMvc.perform(multipart("/api/v1/core/admin/employees/import/preview")
                        .file(csvPart)
                        .header("Authorization", "Bearer " + saToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.batchId").isNumber())
                .andExpect(jsonPath("$.data.fileFormat").value("CSV"))
                .andExpect(jsonPath("$.data.detectedSchema").value("HIERARCHY_STANDARD"))
                .andExpect(jsonPath("$.data.managerColumnDetected").value(true))
                .andExpect(jsonPath("$.data.totalSourceRows").value(3))
                .andExpect(jsonPath("$.data.uniqueEmployees").value(3))
                .andExpect(jsonPath("$.data.employeesToCreate").value(3))
                .andExpect(jsonPath("$.data.departmentsToCreate").value(3))
                .andExpect(jsonPath("$.data.managersToLink").value(2))
                .andExpect(jsonPath("$.data.errorRows").value(0))
                .andReturn();

        long batchId = objectMapper.readTree(previewRes.getResponse().getContentAsString())
                .at("/data/batchId").asLong();

        mockMvc.perform(post("/api/v1/core/admin/employees/import/batches/" + batchId + "/commit")
                        .header("Authorization", "Bearer " + saToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("COMMITTED"))
                .andExpect(jsonPath("$.data.employeesCreated").value(3))
                .andExpect(jsonPath("$.data.departmentsCreated").value(3))
                .andExpect(jsonPath("$.data.managersLinked").value(2));

        EmployeeDto alexDto = employeeQueryService.getByEmployeeNumber(empAlex);
        EmployeeDto kebedeDto = employeeQueryService.getByEmployeeNumber(empKebede);
        EmployeeDto abebeDto = employeeQueryService.getByEmployeeNumber(empAbebe);
        assertThat(alexDto.managerId()).isEqualTo(kebedeDto.id());
        assertThat(kebedeDto.managerId()).isEqualTo(abebeDto.id());
        assertThat(abebeDto.managerId()).isNull();
        assertThat(alexDto.parentDepartmentName()).isEqualTo("Technology " + s);
        assertThat(alexDto.departmentName()).isEqualTo("Platform Engineering " + s);

        // Second CSV: unknown manager + attempted circular manager on Kebede -> Alex => commit rejected, no partial changes
        String badCsv = String.join("\n",
                "EmployeeNumber,FullName,Email,Gender,ParentDepartment,Department,Job,Position,ManagerEmployeeNumber",
                empAlex + ",Alex Tesfaye Updated,alex.csv." + s + "@boa.et,Male,Technology " + s + ",Platform Engineering " + s + ",Software Engineer,Principal Engineer," + empKebede,
                empKebede + ",Kebede Hailu,kebede.csv." + s + "@boa.et,Male,Technology " + s + ",Platform Engineering " + s + ",Engineering Manager,Engineering Lead," + empAlex,
                "CSV-BAD-" + s + ",Missing Manager Row,missing." + s + "@boa.et,Female,Technology " + s + ",Platform Engineering " + s + ",QA,QA Engineer,NO-SUCH-MGR"
        );

        MockMultipartFile secondPart = new MockMultipartFile(
                "file", "boa-hierarchy-update.csv", "text/csv", badCsv.getBytes(StandardCharsets.UTF_8)
        );

        MvcResult badPreviewRes = mockMvc.perform(multipart("/api/v1/core/admin/employees/import/preview")
                        .file(secondPart)
                        .header("Authorization", "Bearer " + saToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.errorRows").value(3))
                .andExpect(jsonPath("$.data.rows.content[0].rowStatus").value("ERROR"))
                .andExpect(jsonPath("$.data.rows.content[1].rowStatus").value("ERROR"))
                .andExpect(jsonPath("$.data.rows.content[2].rowStatus").value("ERROR"))
                .andReturn();

        long badBatchId = objectMapper.readTree(badPreviewRes.getResponse().getContentAsString())
                .at("/data/batchId").asLong();

        mockMvc.perform(post("/api/v1/core/admin/employees/import/batches/" + badBatchId + "/commit")
                        .header("Authorization", "Bearer " + saToken))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errorCode").value("IMPORT_BATCH_HAS_ERRORS"));

        // Verify zero partial mutations from rejected batch
        assertThat(employeeQueryService.findByEmployeeNumber("CSV-BAD-" + s)).isEmpty();
        assertThat(employeeQueryService.getByEmployeeNumber(empAlex).position()).isEqualTo("Senior Engineer");
    }

    // --- Helpers ---

    private Role createCustomRole(String name, Set<String> permissionCodes) {
        Role role = new Role();
        role.setName(name);
        role.setDescription("Phase 3 test role");
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

    private User createDirectUser(String username, String rawPassword, Role... roles) {
        User user = new User();
        user.setUsername(username.toLowerCase(Locale.ROOT));
        user.setPasswordHash(passwordEncoder.encode(rawPassword));
        user.setAuthProvider(AuthProvider.LOCAL);
        user.setStatus(UserStatus.ACTIVE);
        user.setMustChangePassword(false);
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

        JsonNode body = objectMapper.readTree(result.getResponse().getContentAsString());
        Cookie refreshCookie = result.getResponse().getCookie(AuthController.REFRESH_COOKIE_NAME);
        assertThat(refreshCookie).isNotNull();
        return body.at("/data/accessToken").asText();
    }

    private static String suffix() {
        return UUID.randomUUID().toString().substring(0, 8);
    }

    private static String nextIp() {
        int seq = IP_SEQ.getAndIncrement();
        return "10.201." + (seq / 250) + "." + ((seq % 250) + 1);
    }
}

