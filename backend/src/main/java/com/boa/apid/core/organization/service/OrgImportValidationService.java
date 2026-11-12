package com.boa.apid.core.organization.service;

import com.boa.apid.core.organization.entity.Department;
import com.boa.apid.core.organization.entity.Employee;
import com.boa.apid.core.organization.entity.EmploymentStatus;
import com.boa.apid.core.organization.entity.OrgImportBatchRow;
import com.boa.apid.core.organization.entity.OrgImportPlannedAction;
import com.boa.apid.core.organization.entity.OrgImportRowStatus;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.regex.Pattern;

/**
 * Pure validation, multi-row deduplication, department ambiguity checks, blank-cell preservation,
 * and O(V + E) iterative cycle detection for organization bulk imports.
 */
@Service
class OrgImportValidationService {

    private static final Pattern SIMPLE_EMAIL = Pattern.compile("^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$");

    record ValidatedRowPlan(
            int primaryRowNumber,
            String employeeNumber,
            String fullName,
            String email,
            String gender,
            String parentDepartment,
            String department,
            String departmentCode,
            String job,
            String position,
            String managerEmployeeNumber,
            EmploymentStatus employmentStatus,
            List<Integer> sourceRowNumbers,
            OrgImportPlannedAction plannedAction,
            OrgImportRowStatus rowStatus,
            List<String> errors,
            List<String> warnings
    ) {
        Map<String, Object> toNormalizedMap() {
            Map<String, Object> map = new LinkedHashMap<>();
            if (fullName != null) map.put("fullName", fullName);
            if (email != null) map.put("email", email);
            if (gender != null) map.put("gender", gender);
            if (parentDepartment != null) map.put("parentDepartment", parentDepartment);
            if (department != null) map.put("department", department);
            if (departmentCode != null) map.put("departmentCode", departmentCode);
            if (job != null) map.put("job", job);
            if (position != null) map.put("position", position);
            if (managerEmployeeNumber != null) map.put("managerEmployeeNumber", managerEmployeeNumber);
            if (employmentStatus != null) map.put("employmentStatus", employmentStatus.name());
            map.put("sourceRowNumbers", sourceRowNumbers);
            return map;
        }
    }

    record BatchValidationPlan(
            int totalSourceRows,
            int uniqueEmployees,
            int duplicateRowsCollapsed,
            int employeesToCreate,
            int employeesToUpdate,
            int departmentsToCreate,
            int managersToLink,
            int errorRows,
            int warningRows,
            List<String> summaryWarnings,
            List<ValidatedRowPlan> rows
    ) {}

    private record DeptIdentity(String parentLower, String nameLower) {}

    private static final class EmployeeGroupDraft {
        final String empNoKey;
        final String canonicalEmpNo;
        final List<HierarchyTabularParser.ParsedRow> sourceRows = new ArrayList<>();
        final List<Integer> sourceRowNumbers = new ArrayList<>();
        final Set<String> errors = new LinkedHashSet<>();
        final Set<String> warnings = new LinkedHashSet<>();
        HierarchyTabularParser.ParsedRow representative;

        EmployeeGroupDraft(String empNoKey, HierarchyTabularParser.ParsedRow firstRow) {
            this.empNoKey = empNoKey;
            this.canonicalEmpNo = firstRow.employeeNumber().trimmed();
            this.representative = firstRow;
        }
    }

    BatchValidationPlan validateFromParse(
            HierarchyTabularParser.ParseOutput parsed,
            List<Employee> existingEmployees,
            List<Department> existingDepartments
    ) {
        List<String> summaryWarnings = new ArrayList<>(parsed.parserWarnings());
        Map<String, Boolean> presence = parsed.columnPresence();
        if (!Boolean.TRUE.equals(presence.get("managerEmployeeNumber"))) {
            summaryWarnings.add("No ManagerEmployeeNumber column detected; existing direct manager assignments will be preserved.");
        }

        List<ValidatedRowPlan> unkeyedErrorRows = new ArrayList<>();
        Map<String, EmployeeGroupDraft> groupsByEmpNo = new LinkedHashMap<>();

        for (HierarchyTabularParser.ParsedRow row : parsed.rows()) {
            List<String> rowErrors = new ArrayList<>();
            List<String> rowWarnings = new ArrayList<>();
            validateCellSafetyAndBasics(row, rowErrors, rowWarnings);

            String empNo = row.employeeNumber().trimmed();
            if (empNo == null || empNo.isBlank()) {
                if (rowErrors.isEmpty()) {
                    rowErrors.add("EmployeeNumber is required");
                }
                unkeyedErrorRows.add(toImmediateErrorRow(row, rowErrors, rowWarnings));
                continue;
            }

            String key = empNo.toLowerCase(Locale.ROOT);
            EmployeeGroupDraft group = groupsByEmpNo.computeIfAbsent(key, k -> new EmployeeGroupDraft(k, row));
            group.sourceRows.add(row);
            group.sourceRowNumbers.add(row.rowNumber());
            group.errors.addAll(rowErrors);
            group.warnings.addAll(rowWarnings);
        }

        int duplicateRowsCollapsed = 0;
        List<CandidateProfile> candidates = new ArrayList<>();
        for (EmployeeGroupDraft group : groupsByEmpNo.values()) {
            if (group.sourceRows.size() > 1) {
                duplicateRowsCollapsed += (group.sourceRows.size() - 1);
                List<String> conflictFields = detectGroupConflicts(group.sourceRows);
                if (!conflictFields.isEmpty()) {
                    group.errors.add("Conflicting profile data across repeated rows " + group.sourceRowNumbers
                            + " for EmployeeNumber " + group.canonicalEmpNo + ": fields " + conflictFields);
                }
            }
            candidates.add(toCandidateFromParsed(group));
        }

        return evaluateCandidates(
                parsed.rows().size(),
                duplicateRowsCollapsed,
                presence,
                summaryWarnings,
                unkeyedErrorRows,
                candidates,
                existingEmployees,
                existingDepartments
        );
    }

    BatchValidationPlan revalidateFromStoredRows(
            int totalSourceRows,
            int duplicateRowsCollapsed,
            Map<String, Boolean> presence,
            List<String> existingWarnings,
            List<OrgImportBatchRow> storedRows,
            List<Employee> existingEmployees,
            List<Department> existingDepartments
    ) {
        List<String> summaryWarnings = new ArrayList<>(existingWarnings == null ? List.of() : existingWarnings);
        List<ValidatedRowPlan> unkeyedErrors = new ArrayList<>();
        List<CandidateProfile> candidates = new ArrayList<>();

        for (OrgImportBatchRow row : storedRows) {
            Map<String, Object> data = row.getNormalizedData() == null ? Map.of() : row.getNormalizedData();
            String empNo = asTrimmedString(data.get("employeeNumber"), row.getEmployeeNumber());
            List<Integer> srcNums = extractSourceRowNumbers(data, row.getRowNumber());
            if (empNo == null || empNo.isBlank()) {
                unkeyedErrors.add(new ValidatedRowPlan(
                        row.getRowNumber(),
                        null,
                        asTrimmedString(data.get("fullName"), null),
                        asTrimmedString(data.get("email"), null),
                        asTrimmedString(data.get("gender"), null),
                        asTrimmedString(data.get("parentDepartment"), null),
                        asTrimmedString(data.get("department"), null),
                        asTrimmedString(data.get("departmentCode"), null),
                        asTrimmedString(data.get("job"), null),
                        asTrimmedString(data.get("position"), null),
                        asTrimmedString(data.get("managerEmployeeNumber"), null),
                        parseEmploymentStatusSafe(asTrimmedString(data.get("employmentStatus"), null)),
                        srcNums,
                        OrgImportPlannedAction.ERROR,
                        OrgImportRowStatus.ERROR,
                        row.getValidationErrors() == null || row.getValidationErrors().isEmpty()
                                ? List.of("EmployeeNumber is required")
                                : row.getValidationErrors(),
                        row.getValidationWarnings() == null ? List.of() : row.getValidationWarnings()
                ));
                continue;
            }

            Set<String> errors = new LinkedHashSet<>(row.getValidationErrors() == null ? List.of() : row.getValidationErrors());
            Set<String> warnings = new LinkedHashSet<>(row.getValidationWarnings() == null ? List.of() : row.getValidationWarnings());
            // Keep parser/conflict errors if batch originally had errors; clear stale cycle/DB errors? No: stored batch with errors isn't committable.
            candidates.add(new CandidateProfile(
                    row.getRowNumber(),
                    empNo,
                    asTrimmedString(data.get("fullName"), null),
                    asTrimmedString(data.get("email"), null),
                    asTrimmedString(data.get("gender"), null),
                    asTrimmedString(data.get("parentDepartment"), null),
                    asTrimmedString(data.get("department"), null),
                    asTrimmedString(data.get("departmentCode"), null),
                    asTrimmedString(data.get("job"), null),
                    asTrimmedString(data.get("position"), null),
                    asTrimmedString(data.get("managerEmployeeNumber"), null),
                    parseEmploymentStatusSafe(asTrimmedString(data.get("employmentStatus"), null)),
                    srcNums,
                    errors,
                    warnings
            ));
        }

        return evaluateCandidates(
                totalSourceRows,
                duplicateRowsCollapsed,
                presence,
                summaryWarnings,
                unkeyedErrors,
                candidates,
                existingEmployees,
                existingDepartments
        );
    }

    private static final class CandidateProfile {
        final int primaryRowNumber;
        final String employeeNumber;
        final String fullName;
        final String email;
        final String gender;
        final String parentDepartment;
        final String department;
        final String departmentCode;
        final String job;
        final String position;
        final String managerEmployeeNumber;
        final EmploymentStatus employmentStatus;
        final List<Integer> sourceRowNumbers;
        final Set<String> errors;
        final Set<String> warnings;

        CandidateProfile(
                int primaryRowNumber,
                String employeeNumber,
                String fullName,
                String email,
                String gender,
                String parentDepartment,
                String department,
                String departmentCode,
                String job,
                String position,
                String managerEmployeeNumber,
                EmploymentStatus employmentStatus,
                List<Integer> sourceRowNumbers,
                Set<String> errors,
                Set<String> warnings
        ) {
            this.primaryRowNumber = primaryRowNumber;
            this.employeeNumber = employeeNumber;
            this.fullName = fullName;
            this.email = email;
            this.gender = gender;
            this.parentDepartment = parentDepartment;
            this.department = department;
            this.departmentCode = departmentCode;
            this.job = job;
            this.position = position;
            this.managerEmployeeNumber = managerEmployeeNumber;
            this.employmentStatus = employmentStatus;
            this.sourceRowNumbers = sourceRowNumbers;
            this.errors = errors;
            this.warnings = warnings;
        }
    }

    private BatchValidationPlan evaluateCandidates(
            int totalSourceRows,
            int duplicateRowsCollapsed,
            Map<String, Boolean> presence,
            List<String> summaryWarnings,
            List<ValidatedRowPlan> unkeyedErrors,
            List<CandidateProfile> candidates,
            List<Employee> existingEmployees,
            List<Department> existingDepartments
    ) {
        Map<String, Employee> existingByEmpNo = new HashMap<>();
        Map<String, String> existingEmailOwners = new HashMap<>();
        for (Employee emp : existingEmployees) {
            String key = emp.getEmployeeNumber().toLowerCase(Locale.ROOT);
            existingByEmpNo.put(key, emp);
            if (emp.getEmail() != null && !emp.getEmail().isBlank()) {
                existingEmailOwners.put(emp.getEmail().trim().toLowerCase(Locale.ROOT), key);
            }
        }

        // Preload department indexes for ambiguity + count checks
        Map<String, Department> rootDepts = new HashMap<>();
        Map<DeptIdentity, Department> childDepts = new HashMap<>();
        Map<String, Set<String>> existingParentsByDeptName = new HashMap<>();
        Map<String, Department> existingDeptsByCode = new HashMap<>();
        for (Department dept : existingDepartments) {
            String dNameLower = dept.getName().toLowerCase(Locale.ROOT);
            String pNameLower = dept.getParentDepartment() != null
                    ? dept.getParentDepartment().getName().toLowerCase(Locale.ROOT)
                    : null;
            if (pNameLower == null) {
                rootDepts.put(dNameLower, dept);
            } else {
                childDepts.put(new DeptIdentity(pNameLower, dNameLower), dept);
            }
            existingParentsByDeptName.computeIfAbsent(dNameLower, k -> new HashSet<>())
                    .add(pNameLower == null ? "" : pNameLower);
            if (dept.getCode() != null && !dept.getCode().isBlank()) {
                existingDeptsByCode.put(dept.getCode().trim().toLowerCase(Locale.ROOT), dept);
            }
        }

        // Collect batch-declared parent pairings too so intra-batch ambiguities are also caught
        Map<String, Set<String>> combinedParentsByDeptName = new HashMap<>();
        existingParentsByDeptName.forEach((k, v) -> combinedParentsByDeptName.put(k, new HashSet<>(v)));
        for (CandidateProfile c : candidates) {
            if (c.department != null) {
                String dLower = c.department.toLowerCase(Locale.ROOT);
                if (c.parentDepartment != null) {
                    combinedParentsByDeptName.computeIfAbsent(dLower, k -> new HashSet<>())
                            .add(c.parentDepartment.toLowerCase(Locale.ROOT));
                } else {
                    combinedParentsByDeptName.computeIfAbsent(dLower, k -> new HashSet<>());
                }
            }
        }

        boolean hasEmailCol = Boolean.TRUE.equals(presence.get("email"));
        boolean hasManagerCol = Boolean.TRUE.equals(presence.get("managerEmployeeNumber"));

        // Track email ownership & planned new departments across valid candidates
        Map<String, String> batchEmailOwners = new HashMap<>();
        Set<String> plannedNewRootDepts = new HashSet<>();
        Set<DeptIdentity> plannedNewChildDepts = new HashSet<>();
        Map<String, String> batchCodeTargets = new HashMap<>();

        Map<String, CandidateProfile> candidateByEmpNo = new LinkedHashMap<>();
        for (CandidateProfile c : candidates) {
            candidateByEmpNo.put(c.employeeNumber.toLowerCase(Locale.ROOT), c);
        }

        for (CandidateProfile c : candidates) {
            String empKey = c.employeeNumber.toLowerCase(Locale.ROOT);
            Employee existing = existingByEmpNo.get(empKey);

            // Effective email uniqueness check (across DB and current batch)
            String effectiveEmail = hasEmailCol && c.email != null
                    ? c.email
                    : (existing != null ? existing.getEmail() : null);
            if (effectiveEmail != null && !effectiveEmail.isBlank()) {
                String emailLower = effectiveEmail.trim().toLowerCase(Locale.ROOT);
                String dbOwner = existingEmailOwners.get(emailLower);
                if (dbOwner != null && !dbOwner.equals(empKey)) {
                    c.errors.add("Email '" + effectiveEmail + "' is already assigned to existing employee " + dbOwner);
                }
                String batchOwner = batchEmailOwners.putIfAbsent(emailLower, empKey);
                if (batchOwner != null && !batchOwner.equals(empKey)) {
                    c.errors.add("Email '" + effectiveEmail + "' duplicates employee " + batchOwner + " within this import");
                }
            }

            // Department resolution & ambiguity checks
            if (c.parentDepartment != null || c.department != null) {
                validateAndPlanDepartment(
                        c, rootDepts, childDepts, combinedParentsByDeptName,
                        existingDeptsByCode, plannedNewRootDepts, plannedNewChildDepts, batchCodeTargets
                );
            }
        }

        // Manager existence + O(V + E) iterative cycle detection
        Map<String, String> proposedManagerGraph = new HashMap<>();
        for (Employee emp : existingEmployees) {
            String empKey = emp.getEmployeeNumber().toLowerCase(Locale.ROOT);
            String mgrKey = emp.getManager() != null ? emp.getManager().getEmployeeNumber().toLowerCase(Locale.ROOT) : null;
            proposedManagerGraph.put(empKey, mgrKey);
        }

        for (CandidateProfile c : candidates) {
            String empKey = c.employeeNumber.toLowerCase(Locale.ROOT);
            if (hasManagerCol && c.managerEmployeeNumber != null) {
                String mgrKey = c.managerEmployeeNumber.toLowerCase(Locale.ROOT);
                if (mgrKey.equals(empKey)) {
                    c.errors.add("An employee cannot report to themselves");
                    continue;
                }
                if (!existingByEmpNo.containsKey(mgrKey) && !candidateByEmpNo.containsKey(mgrKey)) {
                    c.errors.add("Manager employee number not found: " + c.managerEmployeeNumber);
                    continue;
                }
                CandidateProfile mgrCandidate = candidateByEmpNo.get(mgrKey);
                if (mgrCandidate != null && !mgrCandidate.errors.isEmpty() && !existingByEmpNo.containsKey(mgrKey)) {
                    c.errors.add("Referenced manager " + c.managerEmployeeNumber + " has validation errors and cannot be created");
                    continue;
                }
                if (c.errors.isEmpty()) {
                    proposedManagerGraph.put(empKey, mgrKey);
                }
            } else {
                // Missing column OR blank cell preserves existing manager
                proposedManagerGraph.putIfAbsent(empKey, null);
            }
        }

        detectCyclesIterative(proposedManagerGraph, candidateByEmpNo);

        // Assemble final row list preserving source order + counts
        int toCreate = 0;
        int toUpdate = 0;
        int managersToLink = 0;
        int errorRows = 0;
        int warningRows = 0;

        List<ValidatedRowPlan> finalRows = new ArrayList<>(unkeyedErrors.size() + candidates.size());
        for (ValidatedRowPlan err : unkeyedErrors) {
            finalRows.add(err);
            errorRows++;
        }

        for (CandidateProfile c : candidates) {
            String empKey = c.employeeNumber.toLowerCase(Locale.ROOT);
            boolean exists = existingByEmpNo.containsKey(empKey);
            OrgImportPlannedAction action;
            OrgImportRowStatus status;
            if (!c.errors.isEmpty()) {
                action = OrgImportPlannedAction.ERROR;
                status = OrgImportRowStatus.ERROR;
                errorRows++;
            } else {
                action = exists ? OrgImportPlannedAction.UPDATE : OrgImportPlannedAction.CREATE;
                if (exists) {
                    toUpdate++;
                } else {
                    toCreate++;
                }
                if (hasManagerCol && c.managerEmployeeNumber != null) {
                    managersToLink++;
                }
                if (!c.warnings.isEmpty()) {
                    status = OrgImportRowStatus.WARNING;
                    warningRows++;
                } else {
                    status = OrgImportRowStatus.VALID;
                }
            }

            finalRows.add(new ValidatedRowPlan(
                    c.primaryRowNumber,
                    c.employeeNumber,
                    c.fullName,
                    c.email,
                    c.gender,
                    c.parentDepartment,
                    c.department,
                    c.departmentCode,
                    c.job,
                    c.position,
                    c.managerEmployeeNumber,
                    c.employmentStatus,
                    c.sourceRowNumbers,
                    action,
                    status,
                    new ArrayList<>(c.errors),
                    new ArrayList<>(c.warnings)
            ));
        }

        finalRows.sort(Comparator.comparingInt(ValidatedRowPlan::primaryRowNumber));

        int deptsToCreate = plannedNewRootDepts.size() + plannedNewChildDepts.size();
        return new BatchValidationPlan(
                totalSourceRows,
                groupsCount(candidates),
                duplicateRowsCollapsed,
                toCreate,
                toUpdate,
                deptsToCreate,
                managersToLink,
                errorRows,
                warningRows,
                summaryWarnings,
                finalRows
        );
    }

    private int groupsCount(List<CandidateProfile> candidates) {
        return candidates.size();
    }

    private void validateAndPlanDepartment(
            CandidateProfile c,
            Map<String, Department> rootDepts,
            Map<DeptIdentity, Department> childDepts,
            Map<String, Set<String>> combinedParentsByDeptName,
            Map<String, Department> existingDeptsByCode,
            Set<String> plannedNewRootDepts,
            Set<DeptIdentity> plannedNewChildDepts,
            Map<String, String> batchCodeTargets
    ) {
        String parentName = c.parentDepartment;
        String deptName = c.department;

        if (parentName == null && deptName != null) {
            String deptLower = deptName.toLowerCase(Locale.ROOT);
            Set<String> parents = combinedParentsByDeptName.getOrDefault(deptLower, Set.of());
            long nonRootCount = parents.stream().filter(p -> !p.isEmpty()).count();

            if (nonRootCount >= 1) {
                c.errors.add("Ambiguous department '" + deptName + "' exists under parent department(s); specify ParentDepartment");
                return;
            }
            if (!rootDepts.containsKey(deptLower)) {
                plannedNewRootDepts.add(deptLower);
            }
        } else if (parentName != null) {
            String parentLower = parentName.toLowerCase(Locale.ROOT);
            if (!rootDepts.containsKey(parentLower)) {
                plannedNewRootDepts.add(parentLower);
            }
            if (deptName != null && !deptName.equalsIgnoreCase(parentName)) {
                String deptLower = deptName.toLowerCase(Locale.ROOT);
                DeptIdentity identity = new DeptIdentity(parentLower, deptLower);
                if (!childDepts.containsKey(identity)) {
                    plannedNewChildDepts.add(identity);
                }
            }
        }

        if (c.departmentCode != null) {
            String codeLower = c.departmentCode.toLowerCase(Locale.ROOT);
            String targetName = (deptName != null ? deptName : parentName);
            String targetKey = (parentName != null ? parentName.toLowerCase(Locale.ROOT) : "") + "::"
                    + (targetName != null ? targetName.toLowerCase(Locale.ROOT) : "");

            Department existingByCode = existingDeptsByCode.get(codeLower);
            if (existingByCode != null) {
                String existingParent = existingByCode.getParentDepartment() != null
                        ? existingByCode.getParentDepartment().getName().toLowerCase(Locale.ROOT)
                        : "";
                String existingKey = existingParent + "::" + existingByCode.getName().toLowerCase(Locale.ROOT);
                if (!existingKey.equals(targetKey)) {
                    c.errors.add("Department code '" + c.departmentCode + "' already belongs to department '" + existingByCode.getName() + "'");
                }
            }
            String prevBatchTarget = batchCodeTargets.putIfAbsent(codeLower, targetKey);
            if (prevBatchTarget != null && !prevBatchTarget.equals(targetKey)) {
                c.errors.add("Department code '" + c.departmentCode + "' is assigned to multiple departments in this file");
            }
        }
    }

    /**
     * Iterative 3-color DFS across the entire proposed reporting graph in O(V + E) time.
     * Color 0 = unvisited, 1 = on active path, 2 = fully checked.
     */
    private void detectCyclesIterative(
            Map<String, String> graph,
            Map<String, CandidateProfile> candidateByEmpNo
    ) {
        Map<String, Integer> color = new HashMap<>(graph.size() * 2);
        for (String start : graph.keySet()) {
            if (color.getOrDefault(start, 0) != 0) {
                continue;
            }
            List<String> path = new ArrayList<>();
            Map<String, Integer> pathIndex = new HashMap<>();
            String curr = start;

            while (curr != null) {
                int state = color.getOrDefault(curr, 0);
                if (state == 2) {
                    break;
                }
                if (state == 1) {
                    int cycleStart = pathIndex.getOrDefault(curr, 0);
                    List<String> cycleNodes = path.subList(cycleStart, path.size());
                    String cycleDesc = String.join(" -> ", cycleNodes) + " -> " + curr;
                    for (String node : cycleNodes) {
                        CandidateProfile candidate = candidateByEmpNo.get(node);
                        if (candidate != null) {
                            candidate.errors.add("Manager assignment creates a circular reporting hierarchy (" + cycleDesc + ")");
                        }
                    }
                    break;
                }
                color.put(curr, 1);
                pathIndex.put(curr, path.size());
                path.add(curr);
                curr = graph.get(curr);
            }

            for (String node : path) {
                color.put(node, 2);
            }
        }
    }

    private void validateCellSafetyAndBasics(
            HierarchyTabularParser.ParsedRow row,
            List<String> errors,
            List<String> warnings
    ) {
        checkCellSafety("EmployeeNumber", row.employeeNumber(), true, errors, warnings);
        checkCellSafety("FullName", row.fullName(), false, errors, warnings);
        checkCellSafety("Email", row.email(), false, errors, warnings);
        checkCellSafety("Gender", row.gender(), false, errors, warnings);
        checkCellSafety("ParentDepartment", row.parentDepartment(), false, errors, warnings);
        checkCellSafety("Department", row.department(), false, errors, warnings);
        checkCellSafety("DepartmentCode", row.departmentCode(), false, errors, warnings);
        checkCellSafety("Job", row.job(), false, errors, warnings);
        checkCellSafety("Position", row.position(), false, errors, warnings);
        checkCellSafety("ManagerEmployeeNumber", row.managerEmployeeNumber(), true, errors, warnings);
        checkCellSafety("EmploymentStatus", row.employmentStatus(), false, errors, warnings);

        String empNo = row.employeeNumber().trimmed();
        if (empNo == null) {
            errors.add("EmployeeNumber is required");
        } else if (empNo.length() > 60) {
            errors.add("EmployeeNumber exceeds 60 characters");
        }

        String fullName = row.fullName().trimmed();
        if (fullName == null) {
            errors.add("FullName is required");
        } else if (fullName.length() > 200) {
            errors.add("FullName exceeds 200 characters");
        }

        String email = row.email().trimmed();
        if (email != null && (email.length() > 200 || !SIMPLE_EMAIL.matcher(email).matches())) {
            errors.add("Invalid email format: " + email);
        }

        checkMaxLength("Gender", row.gender().trimmed(), 30, errors);
        checkMaxLength("ParentDepartment", row.parentDepartment().trimmed(), 150, errors);
        checkMaxLength("Department", row.department().trimmed(), 150, errors);
        checkMaxLength("DepartmentCode", row.departmentCode().trimmed(), 60, errors);
        checkMaxLength("Job", row.job().trimmed(), 150, errors);
        checkMaxLength("Position", row.position().trimmed(), 150, errors);
        checkMaxLength("ManagerEmployeeNumber", row.managerEmployeeNumber().trimmed(), 60, errors);

        String statusText = row.employmentStatus().trimmed();
        if (statusText != null && parseEmploymentStatusSafe(statusText) == null) {
            errors.add("Invalid EmploymentStatus '" + statusText + "' (expected ACTIVE, ON_LEAVE, INACTIVE, or TERMINATED)");
        }
    }

    private void checkCellSafety(
            String fieldName,
            HierarchyTabularParser.CellValue cell,
            boolean identifierField,
            List<String> errors,
            List<String> warnings
    ) {
        if (cell.formulaCell()) {
            errors.add("Formula cells are not allowed in " + fieldName);
        } else if (cell.formulaPrefix()) {
            errors.add("Formula-prefixed values (=, +, -, @) are not allowed in " + fieldName);
        }
        if (identifierField) {
            if (cell.scientificOrDecimalIdentifierRisk()) {
                errors.add(fieldName + " contains scientific notation or decimal formatting ('" + cell.trimmed()
                        + "'); format the column as Text (@) in Excel");
            } else if (cell.generalNumericIdentifierRisk()) {
                warnings.add(fieldName + " uses numeric 'General' formatting in Excel; format column as Text (@) to prevent leading-zero loss");
            }
        }
    }

    private void checkMaxLength(String field, String value, int maxLen, List<String> errors) {
        if (value != null && value.length() > maxLen) {
            errors.add(field + " exceeds " + maxLen + " characters");
        }
    }

    private List<String> detectGroupConflicts(List<HierarchyTabularParser.ParsedRow> rows) {
        HierarchyTabularParser.ParsedRow base = rows.get(0);
        Set<String> conflicts = new LinkedHashSet<>();
        for (int i = 1; i < rows.size(); i++) {
            HierarchyTabularParser.ParsedRow other = rows.get(i);
            if (!eqExact(base.fullName().trimmed(), other.fullName().trimmed())) conflicts.add("fullName");
            if (!eqIgnoreCase(base.email().trimmed(), other.email().trimmed())) conflicts.add("email");
            if (!eqIgnoreCase(base.gender().trimmed(), other.gender().trimmed())) conflicts.add("gender");
            if (!eqIgnoreCase(base.parentDepartment().trimmed(), other.parentDepartment().trimmed())) conflicts.add("parentDepartment");
            if (!eqIgnoreCase(base.department().trimmed(), other.department().trimmed())) conflicts.add("department");
            if (!eqIgnoreCase(base.departmentCode().trimmed(), other.departmentCode().trimmed())) conflicts.add("departmentCode");
            if (!eqExact(base.job().trimmed(), other.job().trimmed())) conflicts.add("job");
            if (!eqExact(base.position().trimmed(), other.position().trimmed())) conflicts.add("position");
            if (!eqIgnoreCase(base.managerEmployeeNumber().trimmed(), other.managerEmployeeNumber().trimmed())) conflicts.add("managerEmployeeNumber");
            if (!eqIgnoreCase(base.employmentStatus().trimmed(), other.employmentStatus().trimmed())) conflicts.add("employmentStatus");
        }
        return new ArrayList<>(conflicts);
    }

    private ValidatedRowPlan toImmediateErrorRow(
            HierarchyTabularParser.ParsedRow row,
            List<String> errors,
            List<String> warnings
    ) {
        return new ValidatedRowPlan(
                row.rowNumber(),
                null,
                row.fullName().trimmed(),
                row.email().trimmed(),
                row.gender().trimmed(),
                row.parentDepartment().trimmed(),
                row.department().trimmed(),
                row.departmentCode().trimmed(),
                row.job().trimmed(),
                row.position().trimmed(),
                row.managerEmployeeNumber().trimmed(),
                parseEmploymentStatusSafe(row.employmentStatus().trimmed()),
                List.of(row.rowNumber()),
                OrgImportPlannedAction.ERROR,
                OrgImportRowStatus.ERROR,
                errors,
                warnings
        );
    }

    private CandidateProfile toCandidateFromParsed(EmployeeGroupDraft group) {
        HierarchyTabularParser.ParsedRow r = group.representative;
        return new CandidateProfile(
                r.rowNumber(),
                group.canonicalEmpNo,
                r.fullName().trimmed(),
                r.email().trimmed(),
                r.gender().trimmed(),
                r.parentDepartment().trimmed(),
                r.department().trimmed(),
                r.departmentCode().trimmed(),
                r.job().trimmed(),
                r.position().trimmed(),
                r.managerEmployeeNumber().trimmed(),
                parseEmploymentStatusSafe(r.employmentStatus().trimmed()),
                group.sourceRowNumbers,
                group.errors,
                group.warnings
        );
    }

    private EmploymentStatus parseEmploymentStatusSafe(String raw) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        try {
            return EmploymentStatus.valueOf(raw.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException ex) {
            return null;
        }
    }

    private boolean eqExact(String a, String b) {
        return Objects.equals(a, b);
    }

    private boolean eqIgnoreCase(String a, String b) {
        if (a == null && b == null) return true;
        if (a == null || b == null) return false;
        return a.equalsIgnoreCase(b);
    }

    private String asTrimmedString(Object value, String fallback) {
        if (value == null) return fallback;
        String s = String.valueOf(value).trim();
        return s.isEmpty() ? fallback : s;
    }

    private List<Integer> extractSourceRowNumbers(Map<String, Object> data, int defaultRow) {
        Object raw = data.get("sourceRowNumbers");
        if (raw instanceof List<?> list && !list.isEmpty()) {
            List<Integer> nums = new ArrayList<>(list.size());
            for (Object item : list) {
                if (item instanceof Number n) {
                    nums.add(n.intValue());
                }
            }
            if (!nums.isEmpty()) return nums;
        }
        return List.of(defaultRow);
    }
}
