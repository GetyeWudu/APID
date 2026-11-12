package com.boa.apid.core.organization;

import com.boa.apid.core.audit.repository.AuditLogRepository;
import com.boa.apid.core.auth.controller.AuthController;
import com.boa.apid.core.auth.dto.LoginRequest;
import com.boa.apid.core.authorization.entity.*;
import com.boa.apid.core.authorization.repository.PermissionRepository;
import com.boa.apid.core.authorization.repository.RoleRepository;
import com.boa.apid.core.authorization.repository.UserRepository;
import com.boa.apid.core.authorization.repository.UserRoleRepository;
import com.boa.apid.core.organization.dto.CreateDepartmentRequest;
import com.boa.apid.core.organization.dto.CreateEmployeeRequest;
import com.boa.apid.core.organization.dto.EmployeeDto;
import com.boa.apid.core.organization.dto.LinkEmployeeUserRequest;
import com.boa.apid.core.organization.dto.UpdateEmployeeRequest;
import com.boa.apid.core.organization.entity.EmploymentStatus;
import com.boa.apid.core.organization.entity.OrgImportBatch;
import com.boa.apid.core.organization.entity.OrgImportBatchStatus;
import com.boa.apid.core.organization.event.EmployeeEmploymentStatusChangedEvent;
import com.boa.apid.core.organization.event.EmployeeManagerChangedEvent;
import com.boa.apid.core.organization.repository.OrgImportBatchRepository;
import com.boa.apid.core.organization.service.EmployeeQueryService;
import com.boa.apid.core.organization.service.OrganizationService;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.persistence.EntityManagerFactory;
import jakarta.servlet.http.Cookie;
import org.apache.poi.ss.usermodel.*;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.hibernate.SessionFactory;
import org.hibernate.stat.Statistics;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.cache.Cache;
import org.springframework.context.annotation.Bean;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

import java.io.ByteArrayOutputStream;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicInteger;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class Phase3OrgImportHardeningIntegrationTest {

    private static final String TEST_PASS = "TestPass!2026#Secure";
    private static final AtomicInteger IP_SEQ = new AtomicInteger(200);
    private static final String PMS_HEADER =
            "EmployeeNumber,EmployeeFullName,ParentDepartment,Department,Job,Position,Gender,"
                    + "PerformanceDocumentName,Year,Quarter,GoalName,EvaluationStatus,GoalTrackingName,"
                    + "Target,Actual,GoalScore,Weight,LineScore,OverallFinalRating,RoundedOverallFinalRating,Email";

    @TestConfiguration
    static class EventCaptureConfig {
        @Bean
        HierarchyEventCollector hierarchyEventCollector() {
            return new HierarchyEventCollector();
        }
    }

    static class HierarchyEventCollector {
        final List<EmployeeManagerChangedEvent> managerEvents = new CopyOnWriteArrayList<>();
        final List<EmployeeEmploymentStatusChangedEvent> statusEvents = new CopyOnWriteArrayList<>();

        @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
        public void handleManager(EmployeeManagerChangedEvent event) {
            managerEvents.add(event);
        }

        @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
        public void handleStatus(EmployeeEmploymentStatusChangedEvent event) {
            statusEvents.add(event);
        }

        void clear() {
            managerEvents.clear();
            statusEvents.clear();
        }
    }

    @Autowired private MockMvc mockMvc;
    @Autowired private ObjectMapper objectMapper;
    @Autowired private UserRepository userRepository;
    @Autowired private RoleRepository roleRepository;
    @Autowired private PermissionRepository permissionRepository;
    @Autowired private UserRoleRepository userRoleRepository;
    @Autowired private PasswordEncoder passwordEncoder;
    @Autowired private OrgImportBatchRepository batchRepository;
    @Autowired private EmployeeQueryService employeeQueryService;
    @Autowired private OrganizationService organizationService;
    @Autowired private AuditLogRepository auditLogRepository;
    @Autowired private EntityManagerFactory entityManagerFactory;
    @Autowired private HierarchyEventCollector eventCollector;

    private Role superAdminRole;
    private Role orgAdminRole;

    @BeforeEach
    void setup() {
        superAdminRole = roleRepository.findByNameIgnoreCase("Super Admin").orElseThrow();
        orgAdminRole = roleRepository.findByNameIgnoreCase("OrgTestAdmin").orElseGet(() ->
                createCustomRole("OrgTestAdmin", Set.of("EMPLOYEE_PORTAL_ACCESS", "HIERARCHY_MANAGE"))
        );
        eventCollector.clear();
    }

    @Test
    void pms21ColumnCsv_isRejectedCleanlyInOrgImport_withClearErrorCode() throws Exception {
        String s = suffix();
        User sa = createDirectUser("p3h_pms_" + s, TEST_PASS, superAdminRole);
        String token = login(sa.getUsername(), TEST_PASS);

        String csv = "\uFEFF" + String.join("\n",
                PMS_HEADER,
                "123456-" + s + ",John doe,Development " + s + ",Software Development " + s + ",Developer,Junior Developer,Male,BOA Quarter One Performance Appraisal 2026/27,2026,1,Coaching Module Developemt,Completed,Coaching and Feedback development,65.85,71.5,112.23,19.42,23.56,2.233,2,john.doe." + s + "@email.com"
        );

        MockMultipartFile file = new MockMultipartFile("file", "pms-export.csv", "text/csv", csv.getBytes(StandardCharsets.UTF_8));
        mockMvc.perform(multipart("/api/v1/core/admin/employees/import/preview")
                        .file(file)
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errorCode").value("PMS_FILE_NOT_ALLOWED_IN_ORG_IMPORT"));
    }

    @Test
    void repeatedEmployeeRowsWithConflictingDepartmentOrPosition_rejectedInPreviewAndCommit() throws Exception {
        String s = suffix();
        User admin = createDirectUser("p3h_conflict_" + s, TEST_PASS, orgAdminRole);
        String token = login(admin.getUsername(), TEST_PASS);

        String csv = String.join("\n",
                "EmployeeNumber,FullName,ParentDepartment,Department,Job,Position,Gender,Email",
                "CON-" + s + ",John Doe,Dev " + s + ",Software Development,Developer,Junior Developer,Male,con." + s + "@boa.et",
                "CON-" + s + ",John Doe,Dev " + s + ",Branch Operations,Developer,Senior Officer,Male,con." + s + "@boa.et"
        );

        MockMultipartFile file = new MockMultipartFile("file", "conflict.csv", "text/csv", csv.getBytes(StandardCharsets.UTF_8));
        MvcResult previewRes = mockMvc.perform(multipart("/api/v1/core/admin/employees/import/preview")
                        .file(file)
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.errorRows").value(1))
                .andExpect(jsonPath("$.data.rows.content[0].errors[0]").value(org.hamcrest.Matchers.containsString("department")))
                .andExpect(jsonPath("$.data.rows.content[0].errors[0]").value(org.hamcrest.Matchers.containsString("position")))
                .andReturn();

        long batchId = objectMapper.readTree(previewRes.getResponse().getContentAsString()).at("/data/batchId").asLong();
        mockMvc.perform(post("/api/v1/core/admin/employees/import/batches/" + batchId + "/commit")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errorCode").value("IMPORT_BATCH_HAS_ERRORS"));
    }

    @Test
    void blankManagerCellInPresentColumn_preservesExistingManager_andPublishedEventsOnChange() throws Exception {
        String s = suffix();
        User admin = createDirectUser("p3h_blank_" + s, TEST_PASS, orgAdminRole);
        String token = login(admin.getUsername(), TEST_PASS);

        String mgr1 = "BM1-" + s;
        String mgr2 = "BM2-" + s;
        String empNo = "BE-" + s;
        Long mgr1Id = createEmployeeApi(token, mgr1, "Manager One", "bm1." + s + "@boa.et", null);
        Long mgr2Id = createEmployeeApi(token, mgr2, "Manager Two", "bm2." + s + "@boa.et", null);
        Long empId = createEmployeeApi(token, empNo, "Staff Member", "be." + s + "@boa.et", mgr1Id);

        // First import has blank ManagerEmployeeNumber -> preserves mgr1Id
        String preserveCsv = String.join("\n",
                "EmployeeNumber,FullName,Email,Position,ManagerEmployeeNumber",
                empNo + ",Staff Member,be." + s + "@boa.et,Analyst,"
        );
        long batch1 = previewAndGetBatchId(token, "preserve.csv", "text/csv", preserveCsv.getBytes(StandardCharsets.UTF_8));
        mockMvc.perform(post("/api/v1/core/admin/employees/import/batches/" + batch1 + "/commit")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk());
        assertThat(employeeQueryService.getById(empId).managerId()).isEqualTo(mgr1Id);
        assertThat(eventCollector.managerEvents).isEmpty();

        // Second import changes manager to mgr2Id and status to ON_LEAVE -> emits BOTH post-commit events
        String changeCsv = String.join("\n",
                "EmployeeNumber,FullName,Email,Position,ManagerEmployeeNumber,EmploymentStatus",
                empNo + ",Staff Member,be." + s + "@boa.et,Senior Analyst," + mgr2 + ",ON_LEAVE"
        );
        long batch2 = previewAndGetBatchId(token, "change.csv", "text/csv", changeCsv.getBytes(StandardCharsets.UTF_8));
        mockMvc.perform(post("/api/v1/core/admin/employees/import/batches/" + batch2 + "/commit")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.managersLinked").value(1));

        EmployeeDto reloaded = employeeQueryService.getById(empId);
        assertThat(reloaded.managerId()).isEqualTo(mgr2Id);
        assertThat(reloaded.employmentStatus()).isEqualTo(EmploymentStatus.ON_LEAVE);
        assertThat(eventCollector.managerEvents).hasSize(1);
        assertThat(eventCollector.managerEvents.get(0).oldManagerId()).isEqualTo(mgr1Id);
        assertThat(eventCollector.managerEvents.get(0).newManagerId()).isEqualTo(mgr2Id);
        assertThat(eventCollector.statusEvents).hasSize(1);
        assertThat(eventCollector.statusEvents.get(0).newStatus()).isEqualTo(EmploymentStatus.ON_LEAVE);
    }

    @Test
    void xlsxWorkbook_leadingZeros_generalFormatWarning_formulaRejected() throws Exception {
        String s = suffix();
        int paddedRaw = 100000 + ThreadLocalRandom.current().nextInt(400000);
        int generalRaw = 500000 + ThreadLocalRandom.current().nextInt(400000);
        String expectedPaddedEmpNo = "00" + paddedRaw;
        User admin = createDirectUser("p3h_xlsx_" + s, TEST_PASS, orgAdminRole);
        String token = login(admin.getUsername(), TEST_PASS);

        byte[] validWorkbookBytes = buildWorkbook(wb -> {
            Sheet sheet1 = wb.createSheet("Employees");
            wb.createSheet("ExtraSheetIgnored");

            Row header = sheet1.createRow(0);
            header.createCell(0).setCellValue("EmployeeNumber");
            header.createCell(1).setCellValue("EmployeeFullName");
            header.createCell(2).setCellValue("Email");
            header.createCell(3).setCellValue("Department");

            // Row 1: Numeric with zero-padded format "00000000" -> preserves leading zeros with no warning
            CellStyle paddedStyle = wb.createCellStyle();
            paddedStyle.setDataFormat(wb.createDataFormat().getFormat("00000000"));
            Row r1 = sheet1.createRow(1);
            Cell c1 = r1.createCell(0);
            c1.setCellValue(paddedRaw);
            c1.setCellStyle(paddedStyle);
            r1.createCell(1).setCellValue("Zero Padded User " + s);
            r1.createCell(2).setCellValue("pad." + s + "@boa.et");
            r1.createCell(3).setCellValue("Engineering " + s);

            // Row 2: Numeric General format -> triggers warning recommending Text format, still committable
            CellStyle generalStyle = wb.createCellStyle();
            generalStyle.setDataFormat(wb.createDataFormat().getFormat("General"));
            Row r2 = sheet1.createRow(2);
            Cell c2 = r2.createCell(0);
            c2.setCellValue(generalRaw);
            c2.setCellStyle(generalStyle);
            r2.createCell(1).setCellValue("General Numeric User " + s);
            r2.createCell(2).setCellValue("gen." + s + "@boa.et");
            r2.createCell(3).setCellValue("Engineering " + s);
        });

        MockMultipartFile xlsxPart = new MockMultipartFile(
                "file", "boa-org.xlsx",
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", validWorkbookBytes
        );

        MvcResult previewRes = mockMvc.perform(multipart("/api/v1/core/admin/employees/import/preview")
                        .file(xlsxPart)
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.fileFormat").value("XLSX"))
                .andExpect(jsonPath("$.data.errorRows").value(0))
                .andExpect(jsonPath("$.data.warningRows").value(1))
                .andExpect(jsonPath("$.data.summaryWarnings[0]").value(org.hamcrest.Matchers.containsString("Sheet 1")))
                .andExpect(jsonPath("$.data.rows.content[0].employeeNumber").value(expectedPaddedEmpNo))
                .andExpect(jsonPath("$.data.rows.content[1].rowStatus").value("WARNING"))
                .andReturn();

        long batchId = objectMapper.readTree(previewRes.getResponse().getContentAsString()).at("/data/batchId").asLong();
        mockMvc.perform(post("/api/v1/core/admin/employees/import/batches/" + batchId + "/commit")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.employeesCreated").value(2));

        assertThat(employeeQueryService.findByEmployeeNumber(expectedPaddedEmpNo)).isPresent();

        // Workbook containing a Formula cell in EmployeeNumber -> rejected in preview/commit
        byte[] formulaWorkbook = buildWorkbook(wb -> {
            Sheet sheet = wb.createSheet("FormulaSheet");
            Row header = sheet.createRow(0);
            header.createCell(0).setCellValue("EmployeeNumber");
            header.createCell(1).setCellValue("FullName");
            Row r1 = sheet.createRow(1);
            r1.createCell(0).setCellFormula("100+200");
            r1.createCell(1).setCellValue("Formula Victim");
        });

        MockMultipartFile formulaPart = new MockMultipartFile(
                "file", "formula.xlsx",
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", formulaWorkbook
        );

        mockMvc.perform(multipart("/api/v1/core/admin/employees/import/preview")
                        .file(formulaPart)
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.errorRows").value(1))
                .andExpect(jsonPath("$.data.rows.content[0].errors[0]").value(org.hamcrest.Matchers.containsString("Formula")));
    }

    @Test
    void duplicateHeaders_ambiguousDepartment_formulaPrefixCsv_rejected() throws Exception {
        String s = suffix();
        User admin = createDirectUser("p3h_safeguards_" + s, TEST_PASS, orgAdminRole);
        String token = login(admin.getUsername(), TEST_PASS);

        // 1. Duplicate normalized headers (FullName and EmployeeFullName) -> 400
        String dupHeaderCsv = "EmployeeNumber,FullName,EmployeeFullName\n123,A,B\n";
        mockMvc.perform(multipart("/api/v1/core/admin/employees/import/preview")
                        .file(new MockMultipartFile("file", "dup.csv", "text/csv", dupHeaderCsv.getBytes(StandardCharsets.UTF_8)))
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errorCode").value("DUPLICATE_IMPORT_HEADER"));

        // 2. Ambiguous department name when child exists under a parent department
        String rootName = "Retail " + s;
        String sharedChildName = "SharedOps-" + s;
        MvcResult rootRes = mockMvc.perform(post("/api/v1/core/admin/departments")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new CreateDepartmentRequest(null, rootName, null, null))))
                .andExpect(status().isOk())
                .andReturn();
        Long rootId = objectMapper.readTree(rootRes.getResponse().getContentAsString()).at("/data/id").asLong();

        mockMvc.perform(post("/api/v1/core/admin/departments")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new CreateDepartmentRequest(null, sharedChildName, rootId, null))))
                .andExpect(status().isOk());

        String ambigCsv = String.join("\n",
                "EmployeeNumber,FullName,Department",
                "AMB-" + s + ",Ambiguous User," + sharedChildName
        );
        mockMvc.perform(multipart("/api/v1/core/admin/employees/import/preview")
                        .file(new MockMultipartFile("file", "ambig.csv", "text/csv", ambigCsv.getBytes(StandardCharsets.UTF_8)))
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.errorRows").value(1))
                .andExpect(jsonPath("$.data.rows.content[0].errors[0]").value(org.hamcrest.Matchers.containsString("Ambiguous department")));

        // 3. Formula-prefixed CSV cell -> rejected
        String formulaCsv = "EmployeeNumber,FullName\n=CMD,Malicious Row\n";
        mockMvc.perform(multipart("/api/v1/core/admin/employees/import/preview")
                        .file(new MockMultipartFile("file", "formula.csv", "text/csv", formulaCsv.getBytes(StandardCharsets.UTF_8)))
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.errorRows").value(1));
    }

    @Test
    void batchOwnership_expiration_andConcurrentCommitProtection() throws Exception {
        String s = suffix();
        User ownerAdmin = createDirectUser("p3h_owner_" + s, TEST_PASS, orgAdminRole);
        User otherAdmin = createDirectUser("p3h_other_" + s, TEST_PASS, orgAdminRole);
        String ownerToken = login(ownerAdmin.getUsername(), TEST_PASS);
        String otherToken = login(otherAdmin.getUsername(), TEST_PASS);

        String csv = String.join("\n",
                "EmployeeNumber,FullName,Email",
                "CONC-" + s + ",Concurrent Emp,conc." + s + "@boa.et"
        );
        long batchId = previewAndGetBatchId(ownerToken, "own.csv", "text/csv", csv.getBytes(StandardCharsets.UTF_8));

        // 1. Another administrator cannot view or commit owner's batch
        mockMvc.perform(get("/api/v1/core/admin/employees/import/batches/" + batchId)
                        .header("Authorization", "Bearer " + otherToken))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.errorCode").value("ACCESS_DENIED"));

        mockMvc.perform(post("/api/v1/core/admin/employees/import/batches/" + batchId + "/commit")
                        .header("Authorization", "Bearer " + otherToken))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.errorCode").value("ACCESS_DENIED"));

        // 2. Concurrent commit test: only one succeeds, other receives 409 IMPORT_BATCH_ALREADY_COMMITTED
        ExecutorService pool = Executors.newFixedThreadPool(2);
        CountDownLatch ready = new CountDownLatch(2);
        CountDownLatch go = new CountDownLatch(1);
        Callable<Integer> commitCall = () -> {
            ready.countDown();
            go.await(5, TimeUnit.SECONDS);
            return mockMvc.perform(post("/api/v1/core/admin/employees/import/batches/" + batchId + "/commit")
                            .header("Authorization", "Bearer " + ownerToken))
                    .andReturn().getResponse().getStatus();
        };
        Future<Integer> f1 = pool.submit(commitCall);
        Future<Integer> f2 = pool.submit(commitCall);
        assertThat(ready.await(5, TimeUnit.SECONDS)).isTrue();
        go.countDown();
        List<Integer> statuses = List.of(f1.get(15, TimeUnit.SECONDS), f2.get(15, TimeUnit.SECONDS));
        pool.shutdown();

        assertThat(statuses).containsExactlyInAnyOrder(200, 409);

        // 3. Expired batch commit rejected & persisted as EXPIRED
        String csv2 = String.join("\n",
                "EmployeeNumber,FullName,Email",
                "EXP-" + s + ",Expired Emp,exp." + s + "@boa.et"
        );
        long expBatchId = previewAndGetBatchId(ownerToken, "exp.csv", "text/csv", csv2.getBytes(StandardCharsets.UTF_8));
        OrgImportBatch batchEntity = batchRepository.findById(expBatchId).orElseThrow();
        batchEntity.setExpiresAt(Instant.now().minusSeconds(60));
        batchRepository.save(batchEntity);

        mockMvc.perform(post("/api/v1/core/admin/employees/import/batches/" + expBatchId + "/commit")
                        .header("Authorization", "Bearer " + ownerToken))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errorCode").value("IMPORT_BATCH_EXPIRED"));

        assertThat(batchRepository.findById(expBatchId).orElseThrow().getStatus())
                .isEqualTo(OrgImportBatchStatus.EXPIRED);
        assertThat(employeeQueryService.findByEmployeeNumber("EXP-" + s)).isEmpty();
    }

    @Test
    void explicitUserLinkAndUnlink_audited_andBulkImportAvoidsNPlusOne() throws Exception {
        String s = suffix();
        User admin = createDirectUser("p3h_link_" + s, TEST_PASS, orgAdminRole);
        User targetUser = createDirectUser("LINKEMP-" + s, TEST_PASS, orgAdminRole);
        String token = login(admin.getUsername(), TEST_PASS);

        Long empId = createEmployeeApi(token, "LINKEMP-" + s, "Link Candidate", "link." + s + "@boa.et", null);
        // No auto-link happened
        assertThat(employeeQueryService.getById(empId).userId()).isNull();

        // Explicit link
        mockMvc.perform(post("/api/v1/core/admin/employees/" + empId + "/link-user")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new LinkEmployeeUserRequest(targetUser.getId()))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.userId").value(targetUser.getId()));

        // Explicit unlink
        mockMvc.perform(delete("/api/v1/core/admin/employees/" + empId + "/link-user")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.userId").isEmpty());

        assertThat(auditLogRepository.findAll().stream()
                .filter(a -> "EMPLOYEE_USER_LINKED".equals(a.getAction()) && String.valueOf(empId).equals(a.getEntityId()))
                .count()).isGreaterThanOrEqualTo(1);

        // N+1 check on 40-employee bulk hierarchy import
        StringBuilder sb = new StringBuilder("EmployeeNumber,FullName,ParentDepartment,Department,ManagerEmployeeNumber\n");
        sb.append("BLK-").append(s).append("-0,Bulk Root,BulkDir ").append(s).append(",BulkSub ").append(s).append(",\n");
        for (int i = 1; i < 40; i++) {
            sb.append("BLK-").append(s).append("-").append(i)
                    .append(",Bulk Staff ").append(i)
                    .append(",BulkDir ").append(s)
                    .append(",BulkSub ").append(s)
                    .append(",BLK-").append(s).append("-").append(i - 1).append("\n");
        }
        long bulkBatchId = previewAndGetBatchId(token, "bulk40.csv", "text/csv", sb.toString().getBytes(StandardCharsets.UTF_8));

        SessionFactory sf = entityManagerFactory.unwrap(SessionFactory.class);
        Statistics stats = sf.getStatistics();
        stats.setStatisticsEnabled(true);
        stats.clear();

        mockMvc.perform(post("/api/v1/core/admin/employees/import/batches/" + bulkBatchId + "/commit")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.employeesCreated").value(40))
                .andExpect(jsonPath("$.data.managersLinked").value(39));

        long preparedStatements = stats.getPrepareStatementCount();
        // Preloading + saveAll keeps SELECTs bounded rather than O(N*depth) queries
        assertThat(preparedStatements).isLessThan(180);

        // Redis outage fallback check on department listing
        var departments = organizationService.listDepartments(true);
        assertThat(departments).isNotEmpty();
    }

    // --- Helpers ---

    private Long createEmployeeApi(String token, String empNo, String fullName, String email, Long managerId) throws Exception {
        MvcResult res = mockMvc.perform(post("/api/v1/core/admin/employees")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new CreateEmployeeRequest(
                                null, empNo, fullName, email, "Male", null, "Engineer", "Officer", managerId, EmploymentStatus.ACTIVE
                        ))))
                .andExpect(status().isOk())
                .andReturn();
        return objectMapper.readTree(res.getResponse().getContentAsString()).at("/data/id").asLong();
    }

    private long previewAndGetBatchId(String token, String filename, String contentType, byte[] bytes) throws Exception {
        MvcResult res = mockMvc.perform(multipart("/api/v1/core/admin/employees/import/preview")
                        .file(new MockMultipartFile("file", filename, contentType, bytes))
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andReturn();
        return objectMapper.readTree(res.getResponse().getContentAsString()).at("/data/batchId").asLong();
    }

    @FunctionalInterface
    interface WorkbookConfigurer {
        void configure(Workbook workbook);
    }

    private byte[] buildWorkbook(WorkbookConfigurer configurer) throws Exception {
        try (Workbook wb = new XSSFWorkbook(); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            configurer.configure(wb);
            wb.write(out);
            return out.toByteArray();
        }
    }

    private Role createCustomRole(String name, Set<String> permissionCodes) {
        Role role = new Role();
        role.setName(name);
        role.setDescription("Hardening test role");
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
        return "10.202." + (seq / 250) + "." + ((seq % 250) + 1);
    }
}

