package com.boa.apid.coaching.importpms.service;

import com.boa.apid.coaching.importpms.entity.*;
import com.boa.apid.coaching.importpms.repository.PmsImportEmployeeStagingRepository;
import com.boa.apid.core.config.service.CoreConfigService;
import com.boa.apid.core.organization.dto.EmployeeDto;
import com.boa.apid.core.organization.entity.EmploymentStatus;
import com.boa.apid.core.organization.service.EmployeeQueryService;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Consolidates parsed goal rows per employee, validates against Core directory,
 * checks directory drift, determines coaching eligibility, and writes staging records.
 */
@Service
public class PmsImportValidationService {

    private static final BigDecimal WEIGHT_TOLERANCE = new BigDecimal("0.5");
    private static final BigDecimal LINE_SCORE_TOLERANCE = new BigDecimal("0.05");

    private final EmployeeQueryService employeeQueryService;
    private final CoreConfigService coreConfigService;
    private final PmsImportEmployeeStagingRepository stagingRepository;

    public PmsImportValidationService(
            EmployeeQueryService employeeQueryService,
            CoreConfigService coreConfigService,
            PmsImportEmployeeStagingRepository stagingRepository
    ) {
        this.employeeQueryService = employeeQueryService;
        this.coreConfigService = coreConfigService;
        this.stagingRepository = stagingRepository;
    }

    public record ValidationSummary(
            int uniqueEmployees,
            int mandatoryBelow3Count,
            int passingCount,
            int errorRowsCount,
            int warningRowsCount,
            short cutoffUsed
    ) {}

    public ValidationSummary validateAndStage(
            Long batchId,
            List<PmsExcelParser.ParsedGoalRow> goalRows,
            Long performanceFiscalQuarterId
    ) {
        short cutoff = Optional.ofNullable(coreConfigService.getPublicConfig().getMandatoryCutoffRounded())
                .map(Integer::shortValue)
                .orElse((short) 3);

        // Batch-resolve all employees from Core directory in one query
        Set<String> empNumbers = new LinkedHashSet<>();
        for (PmsExcelParser.ParsedGoalRow r : goalRows) {
            if (r.employeeNumber() != null) empNumbers.add(r.employeeNumber().trim());
        }
        Map<String, EmployeeDto> empMap = employeeQueryService.findByEmployeeNumbers(empNumbers);

        // Group goal rows by employeeNumber
        Map<String, List<PmsExcelParser.ParsedGoalRow>> grouped = new LinkedHashMap<>();
        for (PmsExcelParser.ParsedGoalRow row : goalRows) {
            String key = row.employeeNumber() == null ? "" : row.employeeNumber().trim().toLowerCase(Locale.ROOT);
            grouped.computeIfAbsent(key, k -> new ArrayList<>()).add(row);
        }

        int mandatoryCount = 0, passingCount = 0, errorCount = 0, warningCount = 0;

        for (Map.Entry<String, List<PmsExcelParser.ParsedGoalRow>> entry : grouped.entrySet()) {
            String empNumLower = entry.getKey();
            List<PmsExcelParser.ParsedGoalRow> rows = entry.getValue();
            PmsExcelParser.ParsedGoalRow first = rows.get(0);

            List<String> errors = new ArrayList<>();
            List<String> warnings = new ArrayList<>();

            // Collect parser-level row warnings
            for (PmsExcelParser.ParsedGoalRow row : rows) {
                warnings.addAll(row.warnings());
            }

            // Resolve employee from Core directory
            EmployeeDto emp = empMap.get(empNumLower);
            Long resolvedEmployeeId = null;
            Long resolvedManagerEmployeeId = null;
            boolean hasCoacheePortalAccount = false;
            boolean hasCoachPortalAccount = false;

            if (emp == null) {
                errors.add("UNREGISTERED_EMPLOYEE: Employee '" + first.employeeNumber()
                        + "' not found in APID Employee Directory. Ensure the directory is synced before importing PMS reports.");
            } else {
                resolvedEmployeeId = emp.id();
                hasCoacheePortalAccount = emp.userId() != null;

                // Employment status check
                if (emp.employmentStatus() == EmploymentStatus.TERMINATED) {
                    warnings.add("Employee is TERMINATED; mandatory coaching assignment will be skipped.");
                } else if (emp.employmentStatus() == EmploymentStatus.ON_LEAVE) {
                    warnings.add("Employee is ON_LEAVE; coaching assignment will be created per standard policy.");
                }

                // Directory drift check (non-blocking, 7 fields)
                checkDrift("FullName", first.employeeFullName(), emp.fullName(), warnings);
                checkDrift("Email", first.email(), emp.email(), warnings);
                checkDrift("Department", first.department(), emp.departmentName(), warnings);
                checkDrift("Job", first.job(), emp.job(), warnings);
                checkDrift("Position", first.position(), emp.position(), warnings);
                checkDrift("Gender", first.gender(), emp.gender(), warnings);
                checkDrift("ParentDepartment", first.parentDepartment(), emp.parentDepartmentName(), warnings);

                // Manager resolution (for mandatory coaching eligibility)
                if (emp.managerId() != null) {
                    Optional<EmployeeDto> mgr = employeeQueryService.findById(emp.managerId());
                    if (mgr.isPresent() && mgr.get().employmentStatus() != EmploymentStatus.TERMINATED) {
                        resolvedManagerEmployeeId = mgr.get().id();
                        hasCoachPortalAccount = mgr.get().userId() != null;
                        if (!hasCoachPortalAccount) {
                            warnings.add("Direct manager '" + mgr.get().fullName()
                                    + "' has no APID portal account yet; in-app notification will be skipped until account is provisioned.");
                        }
                    } else {
                        warnings.add("PENDING_COACH: Direct manager is inactive or missing; assignment will be PENDING_COACH_ASSIGNMENT.");
                    }
                } else {
                    warnings.add("PENDING_COACH: No direct manager linked; assignment will be PENDING_COACH_ASSIGNMENT.");
                }
            }

            // Cross-row rating consistency
            BigDecimal referenceOFR = first.overallFinalRating();
            short referenceRounded = first.roundedOverallFinalRating();
            for (PmsExcelParser.ParsedGoalRow row : rows) {
                if (row.overallFinalRating() != null && referenceOFR != null
                        && row.overallFinalRating().compareTo(referenceOFR) != 0) {
                    errors.add(String.format("Row %d: OverallFinalRating %.4f differs from row %d value %.4f for same employee.",
                            row.rowNumber(), row.overallFinalRating(), first.rowNumber(), referenceOFR));
                }
                if (row.roundedOverallFinalRating() != referenceRounded) {
                    errors.add(String.format("Row %d: RoundedOverallFinalRating %d differs from row %d value %d for same employee.",
                            row.rowNumber(), row.roundedOverallFinalRating(), first.rowNumber(), referenceRounded));
                }
            }

            // Weight sum check (warning only)
            BigDecimal totalWeight = rows.stream().map(PmsExcelParser.ParsedGoalRow::weight)
                    .filter(Objects::nonNull).reduce(BigDecimal.ZERO, BigDecimal::add);
            BigDecimal weightDiff = totalWeight.subtract(new BigDecimal("100")).abs();
            if (weightDiff.compareTo(WEIGHT_TOLERANCE) > 0) {
                warnings.add(String.format("Goal weights sum to %.2f (expected ~100.00); verify PMS export.", totalWeight));
            }

            // Line score sum vs OFR (warning only — OFR is authoritative from PMS)
            if (referenceOFR != null) {
                BigDecimal lsSum = rows.stream().map(PmsExcelParser.ParsedGoalRow::lineScore)
                        .filter(Objects::nonNull).reduce(BigDecimal.ZERO, BigDecimal::add);
                BigDecimal diff = lsSum.subtract(referenceOFR).abs();
                if (diff.compareTo(LINE_SCORE_TOLERANCE) > 0) {
                    warnings.add(String.format("Sum of LineScores (%.4f) differs from OverallFinalRating (%.4f) by more than tolerance.",
                            lsSum, referenceOFR));
                }
            }

            // Determine planned action
            PmsImportValidationStatus validationStatus;
            PmsImportPlannedAction plannedAction;

            if (!errors.isEmpty()) {
                validationStatus = PmsImportValidationStatus.ERROR;
                plannedAction = PmsImportPlannedAction.BLOCKED;
                errorCount++;
            } else {
                validationStatus = warnings.isEmpty() ? PmsImportValidationStatus.VALID : PmsImportValidationStatus.WARNING;
                boolean isMandatory = referenceRounded < cutoff;
                boolean isTerminated = emp != null && emp.employmentStatus() == EmploymentStatus.TERMINATED;

                if (isTerminated || !isMandatory) {
                    plannedAction = isMandatory ? PmsImportPlannedAction.BLOCKED : PmsImportPlannedAction.NO_ACTION;
                    if (isMandatory) passingCount++; else passingCount++;
                } else {
                    // Will be refined to CONTINUE/CLEAR at commit time based on existing open assignments
                    plannedAction = resolvedManagerEmployeeId != null
                            ? PmsImportPlannedAction.CREATE_ASSIGNMENT
                            : PmsImportPlannedAction.PENDING_COACH;
                    mandatoryCount++;
                }

                if (!warnings.isEmpty()) warningCount++;
            }

            // Build staging entity
            PmsImportEmployeeStaging staging = new PmsImportEmployeeStaging();
            staging.setBatchId(batchId);
            staging.setSourceRowNumber(first.rowNumber());
            staging.setEmployeeNumber(first.employeeNumber());
            staging.setPmsFullName(first.employeeFullName());
            staging.setPmsEmail(first.email());
            staging.setPmsDepartment(first.department());
            staging.setPmsJob(first.job());
            staging.setPmsPosition(first.position());
            staging.setResolvedEmployeeId(resolvedEmployeeId);
            staging.setResolvedManagerEmployeeId(resolvedManagerEmployeeId);
            staging.setHasCoacheePortalAccount(hasCoacheePortalAccount);
            staging.setHasCoachPortalAccount(hasCoachPortalAccount);
            staging.setEvaluationStatus(first.evaluationStatus());
            staging.setOverallFinalRating(first.overallFinalRating());
            staging.setRoundedOverallFinalRating(referenceRounded);
            staging.setGoalCount(rows.size());
            staging.setValidationStatus(validationStatus);
            staging.setPlannedAction(plannedAction);
            staging.setErrors(errors.isEmpty() ? null : errors);
            staging.setWarnings(warnings.isEmpty() ? null : warnings);

            // Build goal line children
            List<PmsImportGoalStaging> goalStaging = new ArrayList<>();
            for (PmsExcelParser.ParsedGoalRow goalRow : rows) {
                PmsImportGoalStaging gs = new PmsImportGoalStaging();
                gs.setSourceRowNumber(goalRow.rowNumber());
                gs.setGoalName(goalRow.goalName());
                gs.setGoalTrackingName(goalRow.goalTrackingName());
                gs.setTargetValue(goalRow.targetValue());
                gs.setActualValue(goalRow.actualValue());
                gs.setGoalScore(goalRow.goalScore());
                gs.setWeight(goalRow.weight());
                gs.setLineScore(goalRow.lineScore());
                goalStaging.add(gs);
            }
            staging.setGoalLines(goalStaging);

            stagingRepository.save(staging);
        }

        return new ValidationSummary(grouped.size(), mandatoryCount, passingCount, errorCount, warningCount, cutoff);
    }

    private void checkDrift(String field, String pmsValue, String coreValue, List<String> warnings) {
        if (pmsValue == null || coreValue == null) return;
        if (!pmsValue.trim().equalsIgnoreCase(coreValue.trim())) {
            warnings.add(String.format(
                    "Directory drift on %s: PMS has '%s', Core directory has '%s'. Core value is authoritative.",
                    field, pmsValue.trim(), coreValue.trim()));
        }
    }
}
