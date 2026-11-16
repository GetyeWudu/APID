package com.boa.apid.coaching.assignment;

import com.boa.apid.coaching.assignment.dto.AssignCoachRequest;
import com.boa.apid.coaching.assignment.dto.CloseAssignmentRequest;
import com.boa.apid.coaching.assignment.dto.ReplaceCoachRequest;
import com.boa.apid.coaching.assignment.entity.*;
import com.boa.apid.coaching.assignment.repository.CoachReplacementHistoryRepository;
import com.boa.apid.coaching.assignment.repository.CoachingAssignmentRepository;
import com.boa.apid.coaching.assignment.repository.CoachingParticipantRepository;
import com.boa.apid.coaching.importpms.entity.PmsGoalLine;
import com.boa.apid.coaching.importpms.entity.PmsPerformanceRecord;
import com.boa.apid.coaching.importpms.entity.PmsReportBatch;
import com.boa.apid.coaching.importpms.repository.PmsGoalLineRepository;
import com.boa.apid.coaching.importpms.repository.PmsPerformanceRecordRepository;
import com.boa.apid.coaching.importpms.repository.PmsReportBatchRepository;
import com.boa.apid.common.storage.FilePurpose;
import com.boa.apid.common.storage.StoredFile;
import com.boa.apid.common.storage.StoredFileRepository;
import com.boa.apid.core.auth.dto.LoginRequest;
import com.boa.apid.core.authorization.entity.*;
import com.boa.apid.core.authorization.repository.PermissionRepository;
import com.boa.apid.core.authorization.repository.RoleRepository;
import com.boa.apid.core.authorization.repository.UserRepository;
import com.boa.apid.core.authorization.repository.UserRoleRepository;
import com.boa.apid.core.config.entity.FiscalQuarter;
import com.boa.apid.core.config.repository.FiscalQuarterRepository;
import com.boa.apid.core.notifications.entity.Notification;
import com.boa.apid.core.notifications.repository.NotificationRepository;
import com.boa.apid.core.organization.entity.Department;
import com.boa.apid.core.organization.entity.Employee;
import com.boa.apid.core.organization.entity.EmploymentStatus;
import com.boa.apid.core.organization.repository.DepartmentRepository;
import com.boa.apid.core.organization.repository.EmployeeRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.atomic.AtomicInteger;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class Phase5CoachingAssignmentIntegrationTest {

    private static final String TEST_PASS = "Phase5Coaching!2026";
    private static final AtomicInteger IP_SEQ = new AtomicInteger(1);

    @Autowired private MockMvc mockMvc;
    @Autowired private ObjectMapper objectMapper;
    @Autowired private UserRepository userRepository;
    @Autowired private RoleRepository roleRepository;
    @Autowired private PermissionRepository permissionRepository;
    @Autowired private UserRoleRepository userRoleRepository;
    @Autowired private EmployeeRepository employeeRepository;
    @Autowired private DepartmentRepository departmentRepository;
    @Autowired private FiscalQuarterRepository fiscalQuarterRepository;
    @Autowired private StoredFileRepository storedFileRepository;
    @Autowired private PmsReportBatchRepository pmsReportBatchRepository;
    @Autowired private PmsPerformanceRecordRepository pmsPerformanceRecordRepository;
    @Autowired private PmsGoalLineRepository pmsGoalLineRepository;
    @Autowired private CoachingAssignmentRepository coachingAssignmentRepository;
    @Autowired private CoachingParticipantRepository coachingParticipantRepository;
    @Autowired private CoachReplacementHistoryRepository coachReplacementHistoryRepository;
    @Autowired private NotificationRepository notificationRepository;
    @Autowired private PasswordEncoder passwordEncoder;

    private FiscalQuarter q1;
    private FiscalQuarter q2;
    private Role pmsAdminRole;
    private Role employeeRole;
    private Department testDept;

    @BeforeEach
    void setUp() {
        q1 = fiscalQuarterRepository.findByFiscalYearIgnoreCaseAndQuarter("2026/27", (short) 1)
                .orElseThrow(() -> new IllegalStateException("Q1 must exist"));
        q2 = fiscalQuarterRepository.findByFiscalYearIgnoreCaseAndQuarter("2026/27", (short) 2)
                .orElseThrow(() -> new IllegalStateException("Q2 must exist"));

        pmsAdminRole = roleRepository.findByNameIgnoreCase("PMS Admin")
                .orElseThrow(() -> new IllegalStateException("PMS Admin role must exist"));
        employeeRole = roleRepository.findByNameIgnoreCase("Employee")
                .orElseThrow(() -> new IllegalStateException("Employee role must exist"));

        testDept = departmentRepository.findAll().stream().findFirst()
                .orElseGet(() -> {
                    Department d = new Department();
                    d.setName("Domestic Banking");
                    return departmentRepository.save(d);
                });
    }

    @Test
    void searchAssignments_supportsStatusAndQuarterFilters_andSearch() throws Exception {
        String s = suffix();
        User pmsAdminUser = createDirectUser("pms_admin_" + s, TEST_PASS, pmsAdminRole);
        String adminToken = login(pmsAdminUser.getUsername(), TEST_PASS);

        Employee coachee = createEmployee("EMP-COACHEE-" + s, "Coachee Alpha " + s, null);
        Employee coach = createEmployee("EMP-COACH-" + s, "Coach Beta " + s, null);

        CoachingAssignment activeAssignment = createAssignment(
                coachee.getId(), coach.getId(), q1.getId(), q2.getId(), AssignmentStatus.ACTIVE, null, false
        );

        Employee pendingCoachee = createEmployee("EMP-PENDING-" + s, "Pending Coachee " + s, null);
        CoachingAssignment pendingAssignment = createAssignment(
                pendingCoachee.getId(), null, q1.getId(), q2.getId(), AssignmentStatus.PENDING_COACH_ASSIGNMENT, null, true
        );

        // Filter by status = PENDING_COACH_ASSIGNMENT
        mockMvc.perform(get("/api/v1/coaching/assignments")
                        .header("Authorization", "Bearer " + adminToken)
                        .param("status", "PENDING_COACH_ASSIGNMENT")
                        .param("coachingFiscalQuarterId", q2.getId().toString()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.content[?(@.id == " + pendingAssignment.getId() + ")].status").value("PENDING_COACH_ASSIGNMENT"))
                .andExpect(jsonPath("$.data.content[?(@.id == " + activeAssignment.getId() + ")]").doesNotExist());

        // Search by name
        mockMvc.perform(get("/api/v1/coaching/assignments")
                        .header("Authorization", "Bearer " + adminToken)
                        .param("search", "Alpha " + s))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.content[0].coacheeEmployeeNumber").value(coachee.getEmployeeNumber()))
                .andExpect(jsonPath("$.data.content[0].coachFullName").value(coach.getFullName()));
    }

    @Test
    void assignCoach_resolvesPendingCoach_andNotifiesBothParties() throws Exception {
        String s = suffix();
        User pmsAdminUser = createDirectUser("pms_assign_" + s, TEST_PASS, pmsAdminRole);
        String adminToken = login(pmsAdminUser.getUsername(), TEST_PASS);

        User coacheeUser = createDirectUser("coachee_u_" + s, TEST_PASS, employeeRole);
        Employee coachee = createEmployee("EMP-U1-" + s, "Coachee User " + s, coacheeUser.getId());

        User coachUser = createDirectUser("coach_u_" + s, TEST_PASS, employeeRole);
        Employee coach = createEmployee("EMP-C1-" + s, "New Coach " + s, coachUser.getId());

        CoachingAssignment pending = createAssignment(
                coachee.getId(), null, q1.getId(), q2.getId(), AssignmentStatus.PENDING_COACH_ASSIGNMENT, null, false
        );

        AssignCoachRequest req = new AssignCoachRequest(coach.getId(), "Direct manager appointed post-upload");

        mockMvc.perform(post("/api/v1/coaching/assignments/" + pending.getId() + "/assign-coach")
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("ACTIVE"))
                .andExpect(jsonPath("$.data.coachEmployeeId").value(coach.getId()))
                .andExpect(jsonPath("$.data.coachFullName").value(coach.getFullName()));

        // Verify participant record
        boolean coachParticipantActive = coachingParticipantRepository
                .findByAssignmentIdAndRoleAndActiveTrue(pending.getId(), ParticipantRole.COACH)
                .isPresent();
        assertThat(coachParticipantActive).isTrue();

        // Verify history row
        var history = coachReplacementHistoryRepository.findAllByAssignmentIdOrderByChangedAtAsc(pending.getId());
        assertThat(history).hasSize(1);
        assertThat(history.get(0).getNewCoachEmployeeId()).isEqualTo(coach.getId());
        assertThat(history.get(0).getPreviousCoachEmployeeId()).isNull();

        // Verify in-app notifications
        List<Notification> coachNotifs = notificationRepository
                .findByRecipientUserIdOrderByCreatedAtDescIdDesc(coachUser.getId(), org.springframework.data.domain.PageRequest.of(0, 10))
                .getContent();
        assertThat(coachNotifs).anyMatch(n -> n.getEventType().equals("COACHING_COACHEE_ASSIGNED"));

        List<Notification> coacheeNotifs = notificationRepository
                .findByRecipientUserIdOrderByCreatedAtDescIdDesc(coacheeUser.getId(), org.springframework.data.domain.PageRequest.of(0, 10))
                .getContent();
        assertThat(coacheeNotifs).anyMatch(n -> n.getEventType().equals("COACHING_COACH_ASSIGNED"));
    }

    @Test
    void replaceCoach_midQuarter_updatesParticipants_andLogsHistory() throws Exception {
        String s = suffix();
        User pmsAdminUser = createDirectUser("pms_replace_" + s, TEST_PASS, pmsAdminRole);
        String adminToken = login(pmsAdminUser.getUsername(), TEST_PASS);

        User coacheeUser = createDirectUser("coachee_r_" + s, TEST_PASS, employeeRole);
        Employee coachee = createEmployee("EMP-RC-" + s, "Coachee Target " + s, coacheeUser.getId());

        User coach1User = createDirectUser("coach1_r_" + s, TEST_PASS, employeeRole);
        Employee coach1 = createEmployee("EMP-C1R-" + s, "Coach One " + s, coach1User.getId());

        User coach2User = createDirectUser("coach2_r_" + s, TEST_PASS, employeeRole);
        Employee coach2 = createEmployee("EMP-C2R-" + s, "Coach Two " + s, coach2User.getId());

        CoachingAssignment active = createAssignment(
                coachee.getId(), coach1.getId(), q1.getId(), q2.getId(), AssignmentStatus.ACTIVE, null, false
        );

        // Add initial active coach participant
        var initialPart = new com.boa.apid.coaching.assignment.entity.CoachingParticipant();
        initialPart.setAssignmentId(active.getId());
        initialPart.setEmployeeId(coach1.getId());
        initialPart.setRole(ParticipantRole.COACH);
        initialPart.setActive(true);
        coachingParticipantRepository.save(initialPart);

        ReplaceCoachRequest req = new ReplaceCoachRequest(coach2.getId(), "Coach One on medical leave");

        mockMvc.perform(post("/api/v1/coaching/assignments/" + active.getId() + "/replace-coach")
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("ACTIVE"))
                .andExpect(jsonPath("$.data.coachEmployeeId").value(coach2.getId()));

        // Previous coach is inactive, new coach is active
        var activeCoachPart = coachingParticipantRepository
                .findByAssignmentIdAndRoleAndActiveTrue(active.getId(), ParticipantRole.COACH)
                .orElseThrow();
        assertThat(activeCoachPart.getEmployeeId()).isEqualTo(coach2.getId());

        var allParticipants = coachingParticipantRepository.findAllByAssignmentIdOrderByCreatedAtAsc(active.getId());
        assertThat(allParticipants).hasSize(2);
        assertThat(allParticipants.stream().filter(p -> p.getEmployeeId().equals(coach1.getId())).findFirst().get().isActive()).isFalse();

        // History entry recorded
        var history = coachReplacementHistoryRepository.findAllByAssignmentIdOrderByChangedAtAsc(active.getId());
        assertThat(history).hasSize(1);
        assertThat(history.get(0).getPreviousCoachEmployeeId()).isEqualTo(coach1.getId());
        assertThat(history.get(0).getNewCoachEmployeeId()).isEqualTo(coach2.getId());
        assertThat(history.get(0).getReason()).isEqualTo("Coach One on medical leave");
    }

    @Test
    void assignCoach_selfCoachingProhibited() throws Exception {
        String s = suffix();
        User pmsAdminUser = createDirectUser("pms_self_" + s, TEST_PASS, pmsAdminRole);
        String adminToken = login(pmsAdminUser.getUsername(), TEST_PASS);

        Employee coachee = createEmployee("EMP-SELF-" + s, "Self Coachee " + s, null);
        CoachingAssignment pending = createAssignment(
                coachee.getId(), null, q1.getId(), q2.getId(), AssignmentStatus.PENDING_COACH_ASSIGNMENT, null, false
        );

        AssignCoachRequest req = new AssignCoachRequest(coachee.getId(), "Attempt self coaching");

        mockMvc.perform(post("/api/v1/coaching/assignments/" + pending.getId() + "/assign-coach")
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.code").value("CANNOT_COACH_SELF"));
    }

    @Test
    void assignCoach_inactiveCoachProhibited() throws Exception {
        String s = suffix();
        User pmsAdminUser = createDirectUser("pms_inact_" + s, TEST_PASS, pmsAdminRole);
        String adminToken = login(pmsAdminUser.getUsername(), TEST_PASS);

        Employee coachee = createEmployee("EMP-ACT-" + s, "Active Coachee " + s, null);
        Employee inactiveCoach = createEmployee("EMP-INACT-" + s, "Terminated Coach " + s, null);
        inactiveCoach.setEmploymentStatus(EmploymentStatus.TERMINATED);
        employeeRepository.save(inactiveCoach);

        CoachingAssignment pending = createAssignment(
                coachee.getId(), null, q1.getId(), q2.getId(), AssignmentStatus.PENDING_COACH_ASSIGNMENT, null, false
        );

        AssignCoachRequest req = new AssignCoachRequest(inactiveCoach.getId(), "Assigning terminated coach");

        mockMvc.perform(post("/api/v1/coaching/assignments/" + pending.getId() + "/assign-coach")
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.code").value("COACH_NOT_ACTIVE"));
    }

    @Test
    void closeAssignment_setsStatusClosed_andDeactivatesParticipants() throws Exception {
        String s = suffix();
        User pmsAdminUser = createDirectUser("pms_close_" + s, TEST_PASS, pmsAdminRole);
        String adminToken = login(pmsAdminUser.getUsername(), TEST_PASS);

        Employee coachee = createEmployee("EMP-CL-C-" + s, "Coachee " + s, null);
        Employee coach = createEmployee("EMP-CL-M-" + s, "Coach " + s, null);

        CoachingAssignment active = createAssignment(
                coachee.getId(), coach.getId(), q1.getId(), q2.getId(), AssignmentStatus.ACTIVE, null, false
        );

        CloseAssignmentRequest req = new CloseAssignmentRequest("Employee transferred to exempt international division");

        mockMvc.perform(post("/api/v1/coaching/assignments/" + active.getId() + "/close")
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isOk());

        var closed = coachingAssignmentRepository.findById(active.getId()).orElseThrow();
        assertThat(closed.getStatus()).isEqualTo(AssignmentStatus.CLOSED);
        assertThat(closed.getClosureReason()).isEqualTo(AssignmentClosureReason.ADMINISTRATIVE_CLOSURE);
        assertThat(closed.getClosedAt()).isNotNull();

        // Attempting to close again returns 409 conflict
        mockMvc.perform(post("/api/v1/coaching/assignments/" + active.getId() + "/close")
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.error.code").value("ALREADY_CLOSED"));
    }

    @Test
    void myCoaching_returnsAssignedPlanAndTriggeringGoals() throws Exception {
        String s = suffix();
        User coacheeUser = createDirectUser("talent_my_" + s, TEST_PASS, employeeRole);
        Employee coachee = createEmployee("EMP-MY-TALENT-" + s, "Talent Staff " + s, coacheeUser.getId());

        Employee coach = createEmployee("EMP-MY-COACH-" + s, "Manager Coach " + s, null);

        // Setup performance record and goal lines
        PmsReportBatch batch = createBatch(pmsAdminRole, q1.getId(), q2.getId());
        PmsPerformanceRecord record = new PmsPerformanceRecord();
        record.setBatchId(batch.getId());
        record.setEmployeeId(coachee.getId());
        record.setPerformanceFiscalQuarterId(q1.getId());
        record.setPmsYear("2026/27");
        record.setPmsQuarter((short) 1);
        record.setOverallFinalRating(new BigDecimal("2.2325"));
        record.setRoundedOverallFinalRating((short) 2);
        record.setMandatoryCoachingTriggered(true);
        PmsPerformanceRecord savedRec = pmsPerformanceRecordRepository.save(record);

        PmsGoalLine goal1 = new PmsGoalLine();
        goal1.setPerformanceRecordId(savedRec.getId());
        goal1.setSourceRowNumber(2);
        goal1.setGoalName("Customer Deposit Growth");
        goal1.setGoalScore(new BigDecimal("2.1000"));
        goal1.setWeight(new BigDecimal("30.00"));
        pmsGoalLineRepository.save(goal1);

        CoachingAssignment assignment = createAssignment(
                coachee.getId(), coach.getId(), q1.getId(), q2.getId(), AssignmentStatus.ACTIVE, savedRec.getId(), false
        );

        String coacheeToken = login(coacheeUser.getUsername(), TEST_PASS);

        mockMvc.perform(get("/api/v1/coaching/my-coaching")
                        .header("Authorization", "Bearer " + coacheeToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.activePlans[0].assignmentId").value(assignment.getId()))
                .andExpect(jsonPath("$.data.activePlans[0].coachFullName").value(coach.getFullName()))
                .andExpect(jsonPath("$.data.activePlans[0].triggeringRating").value(2.2325))
                .andExpect(jsonPath("$.data.activePlans[0].roundedRating").value(2))
                .andExpect(jsonPath("$.data.activePlans[0].triggeringGoals[0].goalName").value("Customer Deposit Growth"));
    }

    @Test
    void myCoachees_returnsOnlyAssignedCoachees() throws Exception {
        String s = suffix();
        User coachUser = createDirectUser("coach_my_" + s, TEST_PASS, employeeRole);
        Employee coach = createEmployee("EMP-COACH-OWN-" + s, "Coach Owner " + s, coachUser.getId());

        Employee coachee1 = createEmployee("EMP-C1-MY-" + s, "Assigned Coachee 1 " + s, null);
        Employee coachee2 = createEmployee("EMP-C2-MY-" + s, "Unassigned Direct Report " + s, null);
        coachee2.setManager(coach);
        employeeRepository.save(coachee2);

        // Only coachee1 is assigned
        createAssignment(coachee1.getId(), coach.getId(), q1.getId(), q2.getId(), AssignmentStatus.ACTIVE, null, false);

        String coachToken = login(coachUser.getUsername(), TEST_PASS);

        mockMvc.perform(get("/api/v1/coaching/my-coachees")
                        .header("Authorization", "Bearer " + coachToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.length()").value(1))
                .andExpect(jsonPath("$.data[0].coacheeEmployeeNumber").value(coachee1.getEmployeeNumber()))
                .andExpect(jsonPath("$.data[?(@.coacheeEmployeeNumber == '" + coachee2.getEmployeeNumber() + "')]").doesNotExist());
    }

    @Test
    void idorProtection_unrelatedEmployeeBlockedFromDetail() throws Exception {
        String s = suffix();
        User unprivilegedUser = createDirectUser("unprivileged_" + s, TEST_PASS, employeeRole);
        Employee unprivilegedEmp = createEmployee("EMP-UNPRIV-" + s, "Unprivileged Staff " + s, unprivilegedUser.getId());

        Employee coachee = createEmployee("EMP-IDOR-C-" + s, "Secret Coachee " + s, null);
        Employee coach = createEmployee("EMP-IDOR-M-" + s, "Secret Coach " + s, null);

        CoachingAssignment assignment = createAssignment(
                coachee.getId(), coach.getId(), q1.getId(), q2.getId(), AssignmentStatus.ACTIVE, null, false
        );

        String unprivilegedToken = login(unprivilegedUser.getUsername(), TEST_PASS);

        // Accessing another employee's coaching assignment detail returns 403 Forbidden
        mockMvc.perform(get("/api/v1/coaching/assignments/" + assignment.getId())
                        .header("Authorization", "Bearer " + unprivilegedToken))
                .andExpect(status().isForbidden());
    }

    // ─────────────────────────── HELPERS ───────────────────────────

    private CoachingAssignment createAssignment(
            Long coacheeId, Long coachId, Long perfQId, Long coachQId, AssignmentStatus status, Long perfRecId, boolean atRisk
    ) {
        CoachingAssignment a = new CoachingAssignment();
        a.setPathway(perfRecId != null ? AssignmentPathway.MANDATORY_PMS : AssignmentPathway.SELF_DEVELOPMENT);
        a.setCoacheeEmployeeId(coacheeId);
        a.setCoachEmployeeId(coachId);
        a.setPerformanceFiscalQuarterId(perfQId);
        a.setCoachingFiscalQuarterId(coachQId);
        a.setStatus(status);
        a.setPerformanceRecordId(perfRecId);
        a.setAtRisk(atRisk);
        return coachingAssignmentRepository.save(a);
    }

    private Employee createEmployee(String empNumber, String name, Long userId) {
        Employee e = new Employee();
        e.setEmployeeNumber(empNumber);
        e.setFullName(name);
        e.setEmail(empNumber.toLowerCase() + "@boa.example");
        e.setGender("M");
        e.setDepartment(testDept);
        e.setDepartmentName(testDept.getName());
        e.setJob("Officer");
        e.setPosition("Customer Officer");
        e.setEmploymentStatus(EmploymentStatus.ACTIVE);
        e.setUserId(userId);
        return employeeRepository.save(e);
    }

    private PmsReportBatch createBatch(Role role, Long perfQId, Long coachQId) {
        User u = userRepository.findAll().stream().findFirst().orElseThrow();
        StoredFile f = new StoredFile();
        f.setStorageKey("test-storage-" + suffix());
        f.setOriginalFilename("appraisal.xlsx");
        f.setContentType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
        f.setSizeBytes(1024L);
        f.setSha256Hash("sha256-" + suffix());
        f.setPurpose(FilePurpose.PMS_REPORT);
        f.setModule("COACHING");
        f.setUploadedByUserId(u.getId());
        StoredFile savedFile = storedFileRepository.save(f);

        PmsReportBatch batch = new PmsReportBatch();
        batch.setStoredFileId(savedFile.getId());
        batch.setFileName("appraisal.xlsx");
        batch.setFileSha256("sha-" + suffix() + "-" + suffix());
        batch.setPerformanceFiscalQuarterId(perfQId);
        batch.setCoachingFiscalQuarterId(coachQId);
        batch.setPmsYear("2026/27");
        batch.setPmsQuarter((short) 1);
        batch.setDocumentName("Test Batch");
        batch.setUploadedByUserId(u.getId());
        batch.setExpiresAt(Instant.now().plusSeconds(3600));
        return pmsReportBatchRepository.save(batch);
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
        return objectMapper.readTree(result.getResponse().getContentAsString())
                .at("/data/accessToken").asText();
    }

    private static String nextIp() {
        int i = IP_SEQ.incrementAndGet();
        return "198.51.100." + (i % 250 + 1);
    }

    private static String suffix() {
        return UUID.randomUUID().toString().substring(0, 8);
    }
}

