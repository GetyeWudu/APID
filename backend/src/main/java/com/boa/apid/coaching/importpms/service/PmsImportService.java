package com.boa.apid.coaching.importpms.service;

import com.boa.apid.coaching.assignment.entity.*;
import com.boa.apid.coaching.assignment.repository.*;
import com.boa.apid.coaching.importpms.dto.*;
import com.boa.apid.coaching.importpms.entity.*;
import com.boa.apid.coaching.importpms.repository.*;
import com.boa.apid.common.exception.BusinessException;
import com.boa.apid.common.storage.FileStorageService;
import com.boa.apid.common.storage.FilePurpose;
import com.boa.apid.common.storage.StoredFileDto;
import com.boa.apid.core.audit.service.AuditService;
import com.boa.apid.core.auth.security.ApidUserPrincipal;
import com.boa.apid.core.config.dto.FiscalQuarterDto;
import com.boa.apid.core.config.service.CoreConfigService;
import com.boa.apid.core.notifications.entity.NotificationChannel;
import com.boa.apid.core.notifications.entity.NotificationModule;
import com.boa.apid.core.notifications.service.NotificationService;
import com.boa.apid.core.organization.dto.EmployeeDto;
import com.boa.apid.core.organization.service.EmployeeQueryService;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.*;

/**
 * Orchestrates PMS Excel appraisal batch preview and commit lifecycle.
 * Preview: store file → parse → stage → return summary.
 * Commit: validate staged batch → persist official records → trigger coaching assignments.
 */
@Service
public class PmsImportService {

    private static final String MODULE = "COACHING";
    private static final int PREVIEW_TTL_MINUTES = 30;
    private static final long ADVISORY_LOCK_BASE = 500_000L;

    private final FileStorageService fileStorageService;
    private final PmsExcelParser excelParser;
    private final PmsImportValidationService validationService;
    private final PmsReportBatchRepository batchRepository;
    private final PmsImportEmployeeStagingRepository stagingRepository;
    private final PmsPerformanceRecordRepository performanceRecordRepository;
    private final PmsGoalLineRepository goalLineRepository;
    private final CoachingAssignmentRepository assignmentRepository;
    private final CoachingParticipantRepository participantRepository;
    private final CoachReplacementHistoryRepository replacementHistoryRepository;
    private final CoreConfigService coreConfigService;
    private final EmployeeQueryService employeeQueryService;
    private final NotificationService notificationService;
    private final AuditService auditService;

    @PersistenceContext
    private EntityManager entityManager;

    public PmsImportService(
            FileStorageService fileStorageService,
            PmsExcelParser excelParser,
            PmsImportValidationService validationService,
            PmsReportBatchRepository batchRepository,
            PmsImportEmployeeStagingRepository stagingRepository,
            PmsPerformanceRecordRepository performanceRecordRepository,
            PmsGoalLineRepository goalLineRepository,
            CoachingAssignmentRepository assignmentRepository,
            CoachingParticipantRepository participantRepository,
            CoachReplacementHistoryRepository replacementHistoryRepository,
            CoreConfigService coreConfigService,
            EmployeeQueryService employeeQueryService,
            NotificationService notificationService,
            AuditService auditService
    ) {
        this.fileStorageService = fileStorageService;
        this.excelParser = excelParser;
        this.validationService = validationService;
        this.batchRepository = batchRepository;
        this.stagingRepository = stagingRepository;
        this.performanceRecordRepository = performanceRecordRepository;
        this.goalLineRepository = goalLineRepository;
        this.assignmentRepository = assignmentRepository;
        this.participantRepository = participantRepository;
        this.replacementHistoryRepository = replacementHistoryRepository;
        this.coreConfigService = coreConfigService;
        this.employeeQueryService = employeeQueryService;
        this.notificationService = notificationService;
        this.auditService = auditService;
    }

    // ─────────────────────────── STEP 1: PREVIEW ───────────────────────────

    @Transactional
    public PmsBatchPreviewDto preview(
            MultipartFile file,
            Long performanceFiscalQuarterId,
            Long coachingFiscalQuarterId,
            int page,
            int size,
            ApidUserPrincipal actor
    ) {
        // Store file (enforces 25MB, .xlsx, magic bytes, SHA-256)
        StoredFileDto stored = fileStorageService.store(file, FilePurpose.PMS_REPORT, actor);

        // Guard: reject duplicate committed SHA-256
        if (batchRepository.findCommittedBySha256(stored.sha256Hash()).isPresent()) {
            throw new BusinessException("DUPLICATE_PMS_FILE",
                    "This exact file has already been committed. Upload a different file.", HttpStatus.CONFLICT);
        }

        // Guard: reject if quarter already has a committed batch
        if (batchRepository.existsByPerformanceFiscalQuarterIdAndStatus(
                performanceFiscalQuarterId, PmsBatchStatus.COMMITTED)) {
            throw new BusinessException("QUARTER_ALREADY_COMMITTED",
                    "A committed PMS batch already exists for this performance quarter.", HttpStatus.CONFLICT);
        }

        // Validate fiscal quarters exist
        FiscalQuarterDto perfQ = coreConfigService.getFiscalQuarterById(performanceFiscalQuarterId);
        FiscalQuarterDto coachQ = coreConfigService.getFiscalQuarterById(coachingFiscalQuarterId);

        // Parse bytes
        byte[] bytes;
        try { bytes = file.getBytes(); }
        catch (IOException e) {
            throw new BusinessException("FILE_READ_ERROR", "Could not read uploaded file.", HttpStatus.BAD_REQUEST);
        }
        PmsExcelParser.ParseOutput parsed = excelParser.parse(file.getOriginalFilename(), bytes);

        // Verify workbook period consistency vs selected performance quarter
        validatePeriodConsistency(parsed.rows(), perfQ);

        // Create PREVIEW batch record
        short cutoff = Optional.ofNullable(
                coreConfigService.getPublicConfig().getMandatoryCutoffRounded())
                .map(Integer::shortValue)
                .orElse((short) 3);

        PmsReportBatch batch = new PmsReportBatch();
        batch.setStoredFileId(stored.id());
        batch.setFileName(stored.originalFilename());
        batch.setFileSha256(stored.sha256Hash());
        batch.setPerformanceFiscalQuarterId(performanceFiscalQuarterId);
        batch.setCoachingFiscalQuarterId(coachingFiscalQuarterId);
        batch.setPmsYear(parsed.rows().get(0).year());
        batch.setPmsQuarter(Short.parseShort(parsed.rows().get(0).quarter()));
        batch.setDocumentName(parsed.rows().get(0).performanceDocumentName());
        batch.setMandatoryCutoffRounded(cutoff);
        batch.setTotalSourceRows(parsed.totalRows());
        batch.setStatus(PmsBatchStatus.PREVIEW);
        batch.setUploadedByUserId(actor.getUserId());
        batch.setExpiresAt(Instant.now().plus(PREVIEW_TTL_MINUTES, ChronoUnit.MINUTES));
        PmsReportBatch savedBatch = batchRepository.save(batch);

        // Validate & stage employees
        PmsImportValidationService.ValidationSummary summary =
                validationService.validateAndStage(savedBatch.getId(), parsed.rows(), performanceFiscalQuarterId);

        // Update batch counts
        savedBatch.setUniqueEmployeesCount(summary.uniqueEmployees());
        savedBatch.setMandatoryBelow3Count(summary.mandatoryBelow3Count());
        savedBatch.setPassingCount(summary.passingCount());
        savedBatch.setErrorRowsCount(summary.errorRowsCount());
        savedBatch.setWarningRowsCount(summary.warningRowsCount());
        batchRepository.save(savedBatch);

        auditService.record(new AuditService.AuditCommand(
                null, actor.getUserId(), actor.getUsername(), null,
                MODULE, "PMS_BATCH_PREVIEW", "SUCCESS", null,
                "PmsReportBatch", String.valueOf(savedBatch.getId()),
                Map.of("batchId", savedBatch.getId(), "totalRows", parsed.totalRows(),
                        "uniqueEmployees", summary.uniqueEmployees()),
                null, null
        ));

        return buildPreviewDto(savedBatch, page, size, cutoff);
    }

    // ─────────────────────────── STEP 2: GET PREVIEW ───────────────────────

    @Transactional(readOnly = true)
    public PmsBatchPreviewDto getPreview(Long batchId, String filter, int page, int size, ApidUserPrincipal actor) {
        PmsReportBatch batch = batchRepository.findById(batchId)
                .orElseThrow(() -> new BusinessException("BATCH_NOT_FOUND", "PMS batch not found.", HttpStatus.NOT_FOUND));
        if (!batch.getUploadedByUserId().equals(actor.getUserId())) {
            throw new BusinessException("ACCESS_DENIED", "You are not the uploader of this batch.", HttpStatus.FORBIDDEN);
        }
        short cutoff = batch.getMandatoryCutoffRounded();
        return buildPreviewDto(batch, page, size, cutoff);
    }

    // ─────────────────────────── STEP 3: COMMIT ────────────────────────────

    @Transactional
    public PmsCommitResultDto commit(Long batchId, ApidUserPrincipal actor) {
        // Acquire advisory lock on the batch's performance quarter to prevent concurrent commits
        PmsReportBatch batch = batchRepository.findById(batchId)
                .orElseThrow(() -> new BusinessException("BATCH_NOT_FOUND", "PMS batch not found.", HttpStatus.NOT_FOUND));

        entityManager.createNativeQuery(
                "SELECT pg_advisory_xact_lock(:lockKey)"
        ).setParameter("lockKey", ADVISORY_LOCK_BASE + batch.getPerformanceFiscalQuarterId()).getSingleResult();

        // Re-fetch with lock
        batch = batchRepository.findById(batchId)
                .orElseThrow(() -> new BusinessException("BATCH_NOT_FOUND", "Batch not found.", HttpStatus.NOT_FOUND));

        // Pre-flight checks
        if (batch.getStatus() != PmsBatchStatus.PREVIEW) {
            throw new BusinessException("BATCH_NOT_IN_PREVIEW",
                    "Batch is not in PREVIEW status (current: " + batch.getStatus() + ").", HttpStatus.CONFLICT);
        }
        if (Instant.now().isAfter(batch.getExpiresAt())) {
            batch.setStatus(PmsBatchStatus.EXPIRED);
            batchRepository.save(batch);
            throw new BusinessException("BATCH_EXPIRED",
                    "Preview batch has expired. Please re-upload the file.", HttpStatus.CONFLICT);
        }
        if (batch.getErrorRowsCount() > 0) {
            throw new BusinessException("BATCH_HAS_ERRORS",
                    "Cannot commit: batch has " + batch.getErrorRowsCount() + " blocking errors.", HttpStatus.UNPROCESSABLE_ENTITY);
        }
        if (batchRepository.existsByPerformanceFiscalQuarterIdAndStatus(
                batch.getPerformanceFiscalQuarterId(), PmsBatchStatus.COMMITTED)) {
            throw new BusinessException("QUARTER_ALREADY_COMMITTED",
                    "A committed batch for this performance quarter already exists.", HttpStatus.CONFLICT);
        }

        // Check cutoff hasn't changed since preview
        short currentCutoff = Optional.ofNullable(
                coreConfigService.getPublicConfig().getMandatoryCutoffRounded())
                .map(Integer::shortValue)
                .orElse((short) 3);
        if (currentCutoff != batch.getMandatoryCutoffRounded()) {
            batch.setStatus(PmsBatchStatus.FAILED);
            batchRepository.save(batch);
            throw new BusinessException("CUTOFF_CHANGED",
                    "The mandatory coaching cutoff changed after preview. Please re-upload.", HttpStatus.CONFLICT);
        }

        // Load all staged employees for this batch
        List<PmsImportEmployeeStaging> stagingRows = stagingRepository.findAllByBatchId(batchId);

        int created = 0, continued = 0, cleared = 0, pending = 0;

        for (PmsImportEmployeeStaging staging : stagingRows) {
            if (staging.getValidationStatus() == PmsImportValidationStatus.ERROR) continue;

            // Persist performance record
            PmsPerformanceRecord record = new PmsPerformanceRecord();
            record.setBatchId(batchId);
            record.setEmployeeId(staging.getResolvedEmployeeId());
            record.setPerformanceFiscalQuarterId(batch.getPerformanceFiscalQuarterId());
            record.setPmsYear(batch.getPmsYear());
            record.setPmsQuarter(batch.getPmsQuarter());
            record.setEvaluationStatus(staging.getEvaluationStatus());
            record.setOverallFinalRating(staging.getOverallFinalRating());
            record.setRoundedOverallFinalRating(staging.getRoundedOverallFinalRating());

            boolean isMandatory = staging.getRoundedOverallFinalRating() < batch.getMandatoryCutoffRounded();
            record.setMandatoryCoachingTriggered(isMandatory);
            PmsPerformanceRecord savedRecord = performanceRecordRepository.save(record);

            // Persist goal lines
            if (staging.getGoalLines() != null) {
                for (PmsImportGoalStaging gs : staging.getGoalLines()) {
                    PmsGoalLine gl = new PmsGoalLine();
                    gl.setPerformanceRecordId(savedRecord.getId());
                    gl.setSourceRowNumber(gs.getSourceRowNumber());
                    gl.setGoalName(gs.getGoalName());
                    gl.setGoalTrackingName(gs.getGoalTrackingName());
                    gl.setTargetValue(gs.getTargetValue());
                    gl.setActualValue(gs.getActualValue());
                    gl.setGoalScore(gs.getGoalScore());
                    gl.setWeight(gs.getWeight());
                    gl.setLineScore(gs.getLineScore());
                    goalLineRepository.save(gl);
                }
            }

            // Find any open prior mandatory assignments for this coachee
            List<CoachingAssignment> priorOpen = assignmentRepository
                    .findOpenMandatoryByCoacheeEmployeeId(staging.getResolvedEmployeeId());

            if (isMandatory) {
                if (priorOpen.size() > 1) {
                    throw new BusinessException("ASSIGNMENT_INTEGRITY_ERROR",
                            "Employee " + staging.getEmployeeNumber() + " has multiple open mandatory assignments. Manual resolution required.",
                            HttpStatus.CONFLICT);
                }

                // Close prior assignment as CONTINUED if it exists
                if (priorOpen.size() == 1) {
                    CoachingAssignment prior = priorOpen.get(0);
                    prior.setStatus(AssignmentStatus.CLOSED);
                    prior.setClosureReason(AssignmentClosureReason.CONTINUED_NEXT_QUARTER);
                    prior.setClosedAt(Instant.now());
                    assignmentRepository.save(prior);
                    continued++;
                }

                // Create new assignment
                boolean hasManager = staging.getResolvedManagerEmployeeId() != null;
                CoachingAssignment assignment = new CoachingAssignment();
                assignment.setPathway(AssignmentPathway.MANDATORY_PMS);
                assignment.setCoacheeEmployeeId(staging.getResolvedEmployeeId());
                assignment.setCoachEmployeeId(hasManager ? staging.getResolvedManagerEmployeeId() : null);
                assignment.setPerformanceRecordId(savedRecord.getId());
                assignment.setPerformanceFiscalQuarterId(batch.getPerformanceFiscalQuarterId());
                assignment.setCoachingFiscalQuarterId(batch.getCoachingFiscalQuarterId());
                assignment.setPreviousAssignmentId(priorOpen.isEmpty() ? null : priorOpen.get(0).getId());
                assignment.setStatus(hasManager ? AssignmentStatus.ACTIVE : AssignmentStatus.PENDING_COACH_ASSIGNMENT);
                CoachingAssignment savedAssignment = assignmentRepository.save(assignment);

                // Participants
                saveParticipant(savedAssignment.getId(), staging.getResolvedEmployeeId(), ParticipantRole.COACHEE);
                if (hasManager) {
                    saveParticipant(savedAssignment.getId(), staging.getResolvedManagerEmployeeId(), ParticipantRole.COACH);
                    // Record initial coach assignment history
                    CoachReplacementHistory history = new CoachReplacementHistory();
                    history.setAssignmentId(savedAssignment.getId());
                    history.setPreviousCoachEmployeeId(null);
                    history.setNewCoachEmployeeId(staging.getResolvedManagerEmployeeId());
                    history.setReason("Initial mandatory coaching assignment from PMS batch commit.");
                    history.setChangedByUserId(actor.getUserId());
                    replacementHistoryRepository.save(history);
                    pending += 0; // assigned
                } else {
                    pending++;
                }
                created++;

                // Notify (skip if userId is null)
                if (staging.isHasCoacheePortalAccount()) {
                    EmployeeDto coachee = employeeQueryService.findById(staging.getResolvedEmployeeId()).orElse(null);
                    if (coachee != null && coachee.userId() != null) {
                        notificationService.notify(coachee.userId(), NotificationModule.COACHING,
                                "COACHING_ASSIGNMENT_CREATED",
                                "Mandatory Coaching Assignment",
                                "A mandatory coaching session has been assigned to you for this quarter.",
                                "/coaching/my");
                    }
                }
                if (hasManager && staging.isHasCoachPortalAccount()) {
                    EmployeeDto coach = employeeQueryService.findById(staging.getResolvedManagerEmployeeId()).orElse(null);
                    if (coach != null && coach.userId() != null) {
                        notificationService.notify(coach.userId(), NotificationModule.COACHING,
                                "COACHING_COACHEE_ASSIGNED",
                                "New Coachee Assigned",
                                "A new mandatory coaching assignment has been created for one of your team members.",
                                "/coaching/assigned");
                    }
                }

            } else {
                // Passing: clear any prior open mandatory assignment
                if (!priorOpen.isEmpty()) {
                    for (CoachingAssignment prior : priorOpen) {
                        prior.setStatus(AssignmentStatus.CLOSED);
                        prior.setClosureReason(AssignmentClosureReason.CLEARED_BY_PMS);
                        prior.setClosedAt(Instant.now());
                        assignmentRepository.save(prior);
                        cleared++;
                    }
                }
            }
        }

        // Mark batch COMMITTED
        batch.setStatus(PmsBatchStatus.COMMITTED);
        batch.setCommittedByUserId(actor.getUserId());
        batch.setCommittedAt(Instant.now());
        batchRepository.save(batch);

        auditService.record(new AuditService.AuditCommand(
                null, actor.getUserId(), actor.getUsername(), null,
                MODULE, "PMS_BATCH_COMMITTED", "SUCCESS", null,
                "PmsReportBatch", String.valueOf(batchId),
                Map.of("batchId", batchId, "assignmentsCreated", created,
                        "assignmentsContinued", continued, "assignmentsCleared", cleared,
                        "pendingCoach", pending),
                null, null
        ));

        return new PmsCommitResultDto(batchId, stagingRows.size(), created, continued, cleared, pending,
                "PMS batch committed successfully. " + created + " coaching assignments triggered.");
    }

    // ─────────────────────────── STEP 4: CANCEL ────────────────────────────

    @Transactional
    public void cancel(Long batchId, ApidUserPrincipal actor) {
        PmsReportBatch batch = batchRepository.findById(batchId)
                .orElseThrow(() -> new BusinessException("BATCH_NOT_FOUND", "PMS batch not found.", HttpStatus.NOT_FOUND));
        if (!batch.getUploadedByUserId().equals(actor.getUserId())) {
            throw new BusinessException("ACCESS_DENIED", "You are not the uploader of this batch.", HttpStatus.FORBIDDEN);
        }
        if (batch.getStatus() == PmsBatchStatus.COMMITTED) {
            throw new BusinessException("CANNOT_CANCEL_COMMITTED", "Committed batches cannot be cancelled.", HttpStatus.CONFLICT);
        }
        batch.setStatus(PmsBatchStatus.CANCELLED);
        batchRepository.save(batch);
    }

    // ─────────────────────────── STEP 5: HISTORY ───────────────────────────

    @Transactional(readOnly = true)
    public Page<PmsBatchSummaryDto> listHistory(int page, int size) {
        Pageable pageable = PageRequest.of(Math.max(0, page), Math.min(size, 50));
        return batchRepository.findAllByOrderByCreatedAtDesc(pageable)
                .map(b -> new PmsBatchSummaryDto(
                        b.getId(), b.getFileName(), b.getFileSha256().substring(0, 12),
                        null, null, // quarter labels resolved separately via CoreConfigService if needed
                        b.getPmsYear(), b.getPmsQuarter(), b.getStatus(),
                        b.getTotalSourceRows(), b.getUniqueEmployeesCount(),
                        b.getMandatoryBelow3Count(), b.getPassingCount(),
                        b.getErrorRowsCount(), b.getWarningRowsCount(),
                        b.getExpiresAt(), b.getCommittedAt(), b.getCreatedAt()
                ));
    }

    // ─────────────────────────── HELPERS ───────────────────────────────────

    private PmsBatchPreviewDto buildPreviewDto(PmsReportBatch batch, int page, int size, short cutoff) {
        Pageable pageable = PageRequest.of(Math.max(0, page), Math.min(size, 100));
        Page<PmsImportEmployeeStaging> stagingPage = stagingRepository.findByBatchId(batch.getId(), pageable);

        PmsBatchSummaryDto summary = new PmsBatchSummaryDto(
                batch.getId(), batch.getFileName(), batch.getFileSha256().substring(0, 12),
                null, null, batch.getPmsYear(), batch.getPmsQuarter(), batch.getStatus(),
                batch.getTotalSourceRows(), batch.getUniqueEmployeesCount(),
                batch.getMandatoryBelow3Count(), batch.getPassingCount(),
                batch.getErrorRowsCount(), batch.getWarningRowsCount(),
                batch.getExpiresAt(), batch.getCommittedAt(), batch.getCreatedAt()
        );

        Page<PmsConsolidatedEmployeeDto> employeeDtos = stagingPage.map(s -> {
            List<PmsGoalLineDto> goalDtos = s.getGoalLines() == null ? List.of() :
                    s.getGoalLines().stream().map(g -> new PmsGoalLineDto(
                            g.getSourceRowNumber(), g.getGoalName(), g.getGoalTrackingName(),
                            g.getTargetValue(), g.getActualValue(),
                            g.getGoalScore(), g.getWeight(), g.getLineScore()
                    )).toList();

            String resolvedName = s.getPmsFullName();
            String coachName = null;
            if (s.getResolvedManagerEmployeeId() != null) {
                coachName = employeeQueryService.findById(s.getResolvedManagerEmployeeId())
                        .map(EmployeeDto::fullName).orElse(null);
            }

            return new PmsConsolidatedEmployeeDto(
                    s.getId(), s.getEmployeeNumber(), resolvedName, s.getPmsDepartment(),
                    coachName, s.getOverallFinalRating(), s.getRoundedOverallFinalRating(),
                    s.getGoalCount(), s.getEvaluationStatus(),
                    s.getValidationStatus(), s.getPlannedAction(),
                    s.isHasCoacheePortalAccount(), s.isHasCoachPortalAccount(),
                    s.getErrors(), s.getWarnings(), goalDtos
            );
        });

        return new PmsBatchPreviewDto(summary, employeeDtos);
    }

    private void validatePeriodConsistency(List<PmsExcelParser.ParsedGoalRow> rows, FiscalQuarterDto perfQ) {
        for (PmsExcelParser.ParsedGoalRow row : rows) {
            String rowYear = row.year();
            String rowQtr = row.quarter();
            if (rowYear != null && !perfQ.fiscalYear().contains(rowYear)) {
                throw new BusinessException("PERIOD_MISMATCH",
                        String.format("Row %d: Workbook Year '%s' does not match selected Performance Quarter fiscal year '%s'.",
                                row.rowNumber(), rowYear, perfQ.fiscalYear()),
                        HttpStatus.BAD_REQUEST);
            }
            if (rowQtr != null) {
                try {
                    int rowQ = Integer.parseInt(rowQtr.trim());
                    if (rowQ != perfQ.quarter()) {
                        throw new BusinessException("PERIOD_MISMATCH",
                                String.format("Row %d: Workbook Quarter '%s' does not match selected Performance Quarter %d.",
                                        row.rowNumber(), rowQtr, perfQ.quarter()),
                                HttpStatus.BAD_REQUEST);
                    }
                } catch (NumberFormatException e) {
                    throw new BusinessException("INVALID_QUARTER_VALUE",
                            "Row " + row.rowNumber() + ": Quarter must be a number (1-4), got: " + rowQtr,
                            HttpStatus.BAD_REQUEST);
                }
            }
        }
    }

    private void saveParticipant(Long assignmentId, Long employeeId, ParticipantRole role) {
        CoachingParticipant p = new CoachingParticipant();
        p.setAssignmentId(assignmentId);
        p.setEmployeeId(employeeId);
        p.setRole(role);
        p.setActive(true);
        participantRepository.save(p);
    }
}

