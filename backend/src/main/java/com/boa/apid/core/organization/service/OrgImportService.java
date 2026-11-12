package com.boa.apid.core.organization.service;

import com.boa.apid.common.exception.BusinessException;
import com.boa.apid.common.exception.ResourceNotFoundException;
import com.boa.apid.core.audit.service.AuditService;
import com.boa.apid.core.auth.security.ApidUserPrincipal;
import com.boa.apid.core.organization.dto.OrgImportCommitResultDto;
import com.boa.apid.core.organization.dto.OrgImportPreviewDto;
import com.boa.apid.core.organization.dto.OrgImportRowDto;
import com.boa.apid.core.organization.entity.Department;
import com.boa.apid.core.organization.entity.Employee;
import com.boa.apid.core.organization.entity.EmploymentStatus;
import com.boa.apid.core.organization.entity.OrgImportBatch;
import com.boa.apid.core.organization.entity.OrgImportBatchRow;
import com.boa.apid.core.organization.entity.OrgImportBatchStatus;
import com.boa.apid.core.organization.entity.OrgImportRowStatus;
import com.boa.apid.core.organization.event.EmployeeEmploymentStatusChangedEvent;
import com.boa.apid.core.organization.event.EmployeeManagerChangedEvent;
import com.boa.apid.core.organization.repository.DepartmentRepository;
import com.boa.apid.core.organization.repository.EmployeeRepository;
import com.boa.apid.core.organization.repository.OrgImportBatchRepository;
import com.boa.apid.core.organization.repository.OrgImportBatchRowRepository;
import jakarta.persistence.EntityManager;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.*;

@Service
public class OrgImportService {

    static final long ORG_HIERARCHY_ADVISORY_LOCK_KEY = 3001001L;
    private static final String MODULE = "CORE_ORGANIZATION";
    private static final int MAX_PREVIEW_PAGE_SIZE = 100;

    private final OrgImportBatchRepository batchRepository;
    private final OrgImportBatchRowRepository batchRowRepository;
    private final EmployeeRepository employeeRepository;
    private final DepartmentRepository departmentRepository;
    private final OrgImportValidationService validationService;
    private final OrgImportBatchStateHelper batchStateHelper;
    private final ApplicationEventPublisher eventPublisher;
    private final AuditService auditService;
    private final EntityManager entityManager;
    private final TransactionTemplate transactionTemplate;
    private final int previewTtlMinutes;

    public OrgImportService(
            OrgImportBatchRepository batchRepository,
            OrgImportBatchRowRepository batchRowRepository,
            EmployeeRepository employeeRepository,
            DepartmentRepository departmentRepository,
            OrgImportValidationService validationService,
            OrgImportBatchStateHelper batchStateHelper,
            ApplicationEventPublisher eventPublisher,
            AuditService auditService,
            EntityManager entityManager,
            PlatformTransactionManager transactionManager,
            @Value("${apid.org.import-preview-ttl-minutes:30}") int previewTtlMinutes
    ) {
        this.batchRepository = batchRepository;
        this.batchRowRepository = batchRowRepository;
        this.employeeRepository = employeeRepository;
        this.departmentRepository = departmentRepository;
        this.validationService = validationService;
        this.batchStateHelper = batchStateHelper;
        this.eventPublisher = eventPublisher;
        this.auditService = auditService;
        this.entityManager = entityManager;
        this.transactionTemplate = new TransactionTemplate(transactionManager);
        this.previewTtlMinutes = previewTtlMinutes;
    }

    @Transactional
    public OrgImportPreviewDto previewImport(
            MultipartFile file,
            int page,
            int size,
            ApidUserPrincipal actor
    ) {
        if (file == null || file.isEmpty()) {
            throw new BusinessException("EMPTY_IMPORT_FILE", "Uploaded import file must not be empty", HttpStatus.BAD_REQUEST);
        }

        byte[] bytes = readBytes(file);
        HierarchyTabularParser.ParseOutput parsed = HierarchyTabularParser.parse(file.getOriginalFilename(), bytes);

        List<Employee> existingEmployees = employeeRepository.findAllWithDetails();
        List<Department> existingDepartments = departmentRepository.findAllByOrderByNameAsc();

        OrgImportValidationService.BatchValidationPlan plan =
                validationService.validateFromParse(parsed, existingEmployees, existingDepartments);

        OrgImportBatch batch = new OrgImportBatch();
        batch.setUploadedByUserId(actor.getUserId());
        batch.setFileName(truncate(parsed.sanitizedFilename(), 255));
        batch.setFileHash(parsed.fileHashSha256());
        batch.setFileFormat(parsed.fileFormat());
        batch.setDetectedSchema(parsed.detectedSchema());
        batch.setColumnPresenceJson(parsed.columnPresence());
        batch.setStatus(OrgImportBatchStatus.PREVIEWED);
        batch.setTotalSourceRows(plan.totalSourceRows());
        batch.setUniqueEmployees(plan.uniqueEmployees());
        batch.setDuplicateRowsCollapsed(plan.duplicateRowsCollapsed());
        batch.setEmployeesToCreate(plan.employeesToCreate());
        batch.setEmployeesToUpdate(plan.employeesToUpdate());
        batch.setDepartmentsToCreate(plan.departmentsToCreate());
        batch.setManagersToLink(plan.managersToLink());
        batch.setErrorRows(plan.errorRows());
        batch.setWarningRows(plan.warningRows());
        batch.setSummaryWarningsJson(plan.summaryWarnings());
        batch.setExpiresAt(Instant.now().plus(Math.max(1, previewTtlMinutes), ChronoUnit.MINUTES));

        OrgImportBatch savedBatch = batchRepository.save(batch);

        List<OrgImportBatchRow> entities = new ArrayList<>(plan.rows().size());
        for (OrgImportValidationService.ValidatedRowPlan rowPlan : plan.rows()) {
            OrgImportBatchRow rowEntity = new OrgImportBatchRow();
            rowEntity.setBatchId(savedBatch.getId());
            rowEntity.setRowNumber(rowPlan.primaryRowNumber());
            rowEntity.setEmployeeNumber(truncate(rowPlan.employeeNumber(), 60));
            rowEntity.setPlannedAction(rowPlan.plannedAction());
            rowEntity.setRowStatus(rowPlan.rowStatus());
            rowEntity.setNormalizedData(rowPlan.toNormalizedMap());
            rowEntity.setValidationErrors(rowPlan.errors());
            rowEntity.setValidationWarnings(rowPlan.warnings());
            entities.add(rowEntity);
        }
        batchRowRepository.saveAll(entities);
        batchRowRepository.flush();

        auditService.record(new AuditService.AuditCommand(
                null, actor.getUserId(), actor.getUsername(), null,
                MODULE, "ORG_IMPORT_PREVIEWED", "SUCCESS", null,
                "ORG_IMPORT_BATCH", String.valueOf(savedBatch.getId()),
                Map.of(
                        "fileName", savedBatch.getFileName(),
                        "fileHash", savedBatch.getFileHash(),
                        "format", savedBatch.getFileFormat(),
                        "schema", savedBatch.getDetectedSchema(),
                        "totalRows", savedBatch.getTotalSourceRows(),
                        "uniqueEmployees", savedBatch.getUniqueEmployees(),
                        "errorRows", savedBatch.getErrorRows()
                ),
                null, null
        ));

        Page<OrgImportRowDto> rowPage = queryBatchRows(savedBatch.getId(), page, size, null);
        return OrgImportPreviewDto.from(savedBatch, rowPage);
    }

    @Transactional(readOnly = true)
    public OrgImportPreviewDto getBatchPreview(
            Long batchId,
            int page,
            int size,
            OrgImportRowStatus rowStatus,
            ApidUserPrincipal actor
    ) {
        OrgImportBatch batch = batchRepository.findById(batchId)
                .orElseThrow(() -> new ResourceNotFoundException("Import batch not found"));
        assertCanAccessBatch(batch, actor);
        Page<OrgImportRowDto> rows = queryBatchRows(batchId, page, size, rowStatus);
        return OrgImportPreviewDto.from(batch, rows);
    }

    @Transactional
    public void cancelBatch(Long batchId, ApidUserPrincipal actor) {
        acquireHierarchyAdvisoryLock();
        OrgImportBatch batch = batchRepository.findByIdForUpdate(batchId)
                .orElseThrow(() -> new ResourceNotFoundException("Import batch not found"));
        assertCanAccessBatch(batch, actor);

        if (batch.getStatus() == OrgImportBatchStatus.COMMITTED) {
            throw new BusinessException("IMPORT_BATCH_ALREADY_COMMITTED",
                    "Committed import batches cannot be cancelled", HttpStatus.CONFLICT);
        }
        if (batch.getStatus() != OrgImportBatchStatus.CANCELLED) {
            batch.setStatus(OrgImportBatchStatus.CANCELLED);
            batchRepository.save(batch);
            auditService.record(new AuditService.AuditCommand(
                    null, actor.getUserId(), actor.getUsername(), null,
                    MODULE, "ORG_IMPORT_CANCELLED", "SUCCESS", null,
                    "ORG_IMPORT_BATCH", String.valueOf(batchId),
                    Map.of("fileName", batch.getFileName()),
                    null, null
            ));
        }
    }

    private static final class BatchExpiredSignal extends RuntimeException {}

    public OrgImportCommitResultDto commitBatch(Long batchId, ApidUserPrincipal actor) {
        try {
            return transactionTemplate.execute(status -> executeCommitInTx(batchId, actor));
        } catch (BatchExpiredSignal ex) {
            batchStateHelper.markStatus(batchId, OrgImportBatchStatus.EXPIRED);
            throw new BusinessException("IMPORT_BATCH_EXPIRED",
                    "Import preview has expired; please re-upload and preview the file again", HttpStatus.BAD_REQUEST);
        }
    }

    private OrgImportCommitResultDto executeCommitInTx(Long batchId, ApidUserPrincipal actor) {
        acquireHierarchyAdvisoryLock();
        OrgImportBatch batch = batchRepository.findByIdForUpdate(batchId)
                .orElseThrow(() -> new ResourceNotFoundException("Import batch not found"));
        assertCanAccessBatch(batch, actor);

        if (batch.getStatus() == OrgImportBatchStatus.COMMITTED) {
            throw new BusinessException("IMPORT_BATCH_ALREADY_COMMITTED",
                    "This import batch has already been committed", HttpStatus.CONFLICT);
        }
        if (batch.getStatus() == OrgImportBatchStatus.CANCELLED || batch.getStatus() == OrgImportBatchStatus.FAILED) {
            throw new BusinessException("IMPORT_BATCH_NOT_COMMITTABLE",
                    "Import batch is in state " + batch.getStatus() + " and cannot be committed", HttpStatus.CONFLICT);
        }
        if (batch.getStatus() == OrgImportBatchStatus.EXPIRED || Instant.now().isAfter(batch.getExpiresAt())) {
            throw new BatchExpiredSignal();
        }
        if (batch.getErrorRows() > 0) {
            throw new BusinessException("IMPORT_BATCH_HAS_ERRORS",
                    "Cannot commit import batch while " + batch.getErrorRows() + " row(s) contain validation errors",
                    HttpStatus.BAD_REQUEST);
        }

        List<OrgImportBatchRow> storedRows = batchRowRepository.findAllByBatchIdOrderByIdAsc(batchId);
        List<Employee> existingEmployees = employeeRepository.findAllWithDetails();
        List<Department> existingDepartments = departmentRepository.findAllByOrderByNameAsc();

        OrgImportValidationService.BatchValidationPlan livePlan = validationService.revalidateFromStoredRows(
                batch.getTotalSourceRows(),
                batch.getDuplicateRowsCollapsed(),
                batch.getColumnPresenceJson(),
                batch.getSummaryWarningsJson(),
                storedRows,
                existingEmployees,
                existingDepartments
        );

        if (livePlan.errorRows() > 0) {
            throw new BusinessException(
                    "IMPORT_BATCH_REVALIDATION_FAILED",
                    "Commit rejected during live database revalidation: " + livePlan.errorRows() + " conflict(s) detected",
                    HttpStatus.CONFLICT
            );
        }

        CommitCounters counters = applyValidatedPlan(livePlan, batch.getColumnPresenceJson(), existingEmployees, existingDepartments);

        batch.setStatus(OrgImportBatchStatus.COMMITTED);
        batch.setEmployeesCreated(counters.employeesCreated);
        batch.setEmployeesUpdated(counters.employeesUpdated);
        batch.setDepartmentsCreated(counters.departmentsCreated);
        batch.setManagersLinked(counters.managersLinked);
        batch.setCommittedAt(Instant.now());
        OrgImportBatch savedBatch = batchRepository.save(batch);

        if (counters.departmentsCreated > 0 || counters.employeesUpdated > 0) {
            eventPublisher.publishEvent(new DepartmentCacheInvalidationEvent());
        }
        counters.managerEvents.forEach(eventPublisher::publishEvent);
        counters.statusEvents.forEach(eventPublisher::publishEvent);

        auditService.record(new AuditService.AuditCommand(
                null, actor.getUserId(), actor.getUsername(), null,
                MODULE, "ORG_IMPORT_COMMITTED", "SUCCESS", null,
                "ORG_IMPORT_BATCH", String.valueOf(savedBatch.getId()),
                Map.of(
                        "fileName", savedBatch.getFileName(),
                        "fileHash", savedBatch.getFileHash(),
                        "employeesCreated", counters.employeesCreated,
                        "employeesUpdated", counters.employeesUpdated,
                        "departmentsCreated", counters.departmentsCreated,
                        "managersLinked", counters.managersLinked
                ),
                null, null
        ));

        return OrgImportCommitResultDto.from(savedBatch);
    }

    private CommitCounters applyValidatedPlan(
            OrgImportValidationService.BatchValidationPlan plan,
            Map<String, Boolean> presence,
            List<Employee> existingEmployees,
            List<Department> existingDepartments
    ) {
        Map<String, Employee> employeesByNumber = new HashMap<>(existingEmployees.size() * 2 + 16);
        Map<String, Long> previousManagerIds = new HashMap<>(existingEmployees.size() * 2 + 16);
        Map<String, EmploymentStatus> previousStatuses = new HashMap<>(existingEmployees.size() * 2 + 16);
        for (Employee e : existingEmployees) {
            String key = e.getEmployeeNumber().toLowerCase(Locale.ROOT);
            employeesByNumber.put(key, e);
            previousManagerIds.put(key, e.getManager() != null ? e.getManager().getId() : null);
            previousStatuses.put(key, e.getEmploymentStatus());
        }

        DepartmentCacheIndex deptIndex = new DepartmentCacheIndex(existingDepartments);
        List<Department> createdDepartments = new ArrayList<>();

        boolean hasEmailCol = isColPresent(presence, "email");
        boolean hasGenderCol = isColPresent(presence, "gender");
        boolean hasJobCol = isColPresent(presence, "job");
        boolean hasPositionCol = isColPresent(presence, "position");
        boolean hasManagerCol = isColPresent(presence, "managerEmployeeNumber");
        boolean hasStatusCol = isColPresent(presence, "employmentStatus");

        List<Employee> passOneToSave = new ArrayList<>(plan.rows().size());
        List<OrgImportValidationService.ValidatedRowPlan> managerAssignments = new ArrayList<>();
        int employeesCreated = 0;
        int employeesUpdated = 0;

        for (OrgImportValidationService.ValidatedRowPlan row : plan.rows()) {
            String empKey = row.employeeNumber().toLowerCase(Locale.ROOT);
            Employee existing = employeesByNumber.get(empKey);
            boolean isNew = existing == null;
            Employee target = isNew ? new Employee() : existing;

            Department resolvedDept = resolveOrCreateDepartment(
                    row.parentDepartment(), row.department(), row.departmentCode(),
                    deptIndex, createdDepartments
            );

            target.setEmployeeNumber(row.employeeNumber());
            target.setFullName(row.fullName());
            target.setEmail(resolveField(hasEmailCol, row.email(), target.getEmail()));
            target.setGender(truncate(resolveField(hasGenderCol, row.gender(), target.getGender()), 30));
            target.setJob(truncate(resolveField(hasJobCol, row.job(), target.getJob()), 150));
            target.setPosition(truncate(resolveField(hasPositionCol, row.position(), target.getPosition()), 150));

            if (resolvedDept != null) {
                target.setDepartment(resolvedDept);
                target.setDepartmentName(resolvedDept.getName());
                target.setParentDepartmentName(
                        resolvedDept.getParentDepartment() != null ? resolvedDept.getParentDepartment().getName() : null
                );
            }

            if (isNew) {
                target.setEmploymentStatus(row.employmentStatus() != null ? row.employmentStatus() : EmploymentStatus.ACTIVE);
                employeesCreated++;
            } else {
                if (hasStatusCol && row.employmentStatus() != null) {
                    target.setEmploymentStatus(row.employmentStatus());
                }
                employeesUpdated++;
            }

            passOneToSave.add(target);
            employeesByNumber.put(empKey, target);
            if (hasManagerCol && row.managerEmployeeNumber() != null) {
                managerAssignments.add(row);
            }
        }

        if (!createdDepartments.isEmpty()) {
            departmentRepository.flush();
        }
        List<Employee> savedPassOne = employeeRepository.saveAll(passOneToSave);
        employeeRepository.flush();
        for (Employee saved : savedPassOne) {
            employeesByNumber.put(saved.getEmployeeNumber().toLowerCase(Locale.ROOT), saved);
        }

        // Pass 2: link managers & gather hierarchy events
        List<Employee> passTwoUpdates = new ArrayList<>();
        List<EmployeeManagerChangedEvent> managerEvents = new ArrayList<>();
        List<EmployeeEmploymentStatusChangedEvent> statusEvents = new ArrayList<>();
        Instant now = Instant.now();

        for (OrgImportValidationService.ValidatedRowPlan row : managerAssignments) {
            String empKey = row.employeeNumber().toLowerCase(Locale.ROOT);
            Employee emp = employeesByNumber.get(empKey);
            Employee mgr = employeesByNumber.get(row.managerEmployeeNumber().toLowerCase(Locale.ROOT));
            if (mgr == null) {
                throw new BusinessException("IMPORT_MANAGER_NOT_FOUND",
                        "Manager employee number not found during commit: " + row.managerEmployeeNumber(), HttpStatus.CONFLICT);
            }
            Long oldMgrId = previousManagerIds.get(empKey);
            Long newMgrId = mgr.getId();
            if (!Objects.equals(emp.getManager() != null ? emp.getManager().getId() : null, newMgrId)) {
                emp.setManager(mgr);
                passTwoUpdates.add(emp);
            }
            if (!Objects.equals(oldMgrId, newMgrId)) {
                managerEvents.add(new EmployeeManagerChangedEvent(
                        emp.getId(), emp.getEmployeeNumber(), oldMgrId, newMgrId, "BULK_IMPORT", now
                ));
            }
        }

        if (!passTwoUpdates.isEmpty()) {
            employeeRepository.saveAll(passTwoUpdates);
            employeeRepository.flush();
        }

        for (Employee emp : savedPassOne) {
            String key = emp.getEmployeeNumber().toLowerCase(Locale.ROOT);
            if (previousStatuses.containsKey(key)) {
                EmploymentStatus oldStatus = previousStatuses.get(key);
                EmploymentStatus newStatus = emp.getEmploymentStatus();
                if (oldStatus != newStatus) {
                    statusEvents.add(new EmployeeEmploymentStatusChangedEvent(
                            emp.getId(), emp.getEmployeeNumber(), oldStatus, newStatus, "BULK_IMPORT", now
                    ));
                }
            }
        }

        return new CommitCounters(
                employeesCreated,
                employeesUpdated,
                createdDepartments.size(),
                managerAssignments.size(),
                managerEvents,
                statusEvents
        );
    }

    private Department resolveOrCreateDepartment(
            String parentDeptName,
            String deptName,
            String deptCode,
            DepartmentCacheIndex deptIndex,
            List<Department> createdDepartments
    ) {
        if (parentDeptName == null && deptName == null) {
            return null;
        }
        Department parent = null;
        if (parentDeptName != null) {
            String trimmedParent = truncate(parentDeptName, 150);
            String codeForParent = (deptName == null || deptName.equalsIgnoreCase(trimmedParent)) ? truncate(deptCode, 60) : null;
            parent = deptIndex.getOrCreate(trimmedParent, null, codeForParent, departmentRepository, createdDepartments);
        }
        if (deptName == null || (parent != null && parent.getName().equalsIgnoreCase(truncate(deptName, 150)))) {
            return parent;
        }
        return deptIndex.getOrCreate(truncate(deptName, 150), parent, truncate(deptCode, 60), departmentRepository, createdDepartments);
    }

    private static final class DepartmentCacheIndex {
        private final Map<String, Department> rootByName = new HashMap<>();
        private final Map<String, Department> childByParentAndName = new HashMap<>();

        DepartmentCacheIndex(List<Department> existing) {
            for (Department d : existing) {
                if (d.getParentDepartment() == null) {
                    rootByName.put(d.getName().toLowerCase(Locale.ROOT), d);
                } else {
                    String key = d.getParentDepartment().getName().toLowerCase(Locale.ROOT) + "::" + d.getName().toLowerCase(Locale.ROOT);
                    childByParentAndName.put(key, d);
                }
            }
        }

        Department getOrCreate(
                String name,
                Department parent,
                String code,
                DepartmentRepository repo,
                List<Department> createdTracker
        ) {
            String nameLower = name.toLowerCase(Locale.ROOT);
            if (parent == null) {
                Department existing = rootByName.get(nameLower);
                if (existing != null) {
                    return existing;
                }
                Department d = new Department();
                d.setName(name);
                d.setCode(code);
                d.setParentDepartment(null);
                d.setActive(true);
                Department saved = repo.save(d);
                rootByName.put(nameLower, saved);
                createdTracker.add(saved);
                return saved;
            }
            String key = parent.getName().toLowerCase(Locale.ROOT) + "::" + nameLower;
            Department existing = childByParentAndName.get(key);
            if (existing != null) {
                return existing;
            }
            Department d = new Department();
            d.setName(name);
            d.setCode(code);
            d.setParentDepartment(parent);
            d.setActive(true);
            Department saved = repo.save(d);
            childByParentAndName.put(key, saved);
            createdTracker.add(saved);
            return saved;
        }
    }

    private record CommitCounters(
            int employeesCreated,
            int employeesUpdated,
            int departmentsCreated,
            int managersLinked,
            List<EmployeeManagerChangedEvent> managerEvents,
            List<EmployeeEmploymentStatusChangedEvent> statusEvents
    ) {}

    private Page<OrgImportRowDto> queryBatchRows(Long batchId, int page, int size, OrgImportRowStatus rowStatus) {
        int safePage = Math.max(0, page);
        int safeSize = Math.min(Math.max(1, size), MAX_PREVIEW_PAGE_SIZE);
        PageRequest pageable = PageRequest.of(safePage, safeSize);
        Page<OrgImportBatchRow> rows = rowStatus == null
                ? batchRowRepository.findByBatchIdOrderByIdAsc(batchId, pageable)
                : batchRowRepository.findByBatchIdAndRowStatusOrderByIdAsc(batchId, rowStatus, pageable);
        return rows.map(OrgImportRowDto::from);
    }

    private void assertCanAccessBatch(OrgImportBatch batch, ApidUserPrincipal actor) {
        if (!Objects.equals(batch.getUploadedByUserId(), actor.getUserId())) {
            throw new AccessDeniedException("You do not own this import batch");
        }
    }

    private void acquireHierarchyAdvisoryLock() {
        entityManager.createNativeQuery("SELECT pg_advisory_xact_lock(:key)")
                .setParameter("key", ORG_HIERARCHY_ADVISORY_LOCK_KEY)
                .getSingleResult();
    }

    private String resolveField(boolean columnPresent, String incoming, String existing) {
        if (!columnPresent || incoming == null || incoming.isBlank()) {
            return existing;
        }
        return incoming;
    }

    private boolean isColPresent(Map<String, Boolean> presence, String key) {
        return presence != null && Boolean.TRUE.equals(presence.get(key));
    }

    private byte[] readBytes(MultipartFile file) {
        try {
            return file.getBytes();
        } catch (IOException ex) {
            throw new BusinessException("IMPORT_READ_FAILED", "Failed to read uploaded import file", HttpStatus.BAD_REQUEST);
        }
    }

    private String truncate(String val, int maxLen) {
        if (val == null) return null;
        return val.length() <= maxLen ? val : val.substring(0, maxLen);
    }
}
