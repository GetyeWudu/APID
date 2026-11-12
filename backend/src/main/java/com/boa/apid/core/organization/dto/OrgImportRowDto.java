package com.boa.apid.core.organization.dto;

import com.boa.apid.core.organization.entity.OrgImportBatchRow;
import com.boa.apid.core.organization.entity.OrgImportPlannedAction;
import com.boa.apid.core.organization.entity.OrgImportRowStatus;

import java.util.List;
import java.util.Map;

public record OrgImportRowDto(
        Long id,
        int rowNumber,
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
        String employmentStatus,
        List<Integer> sourceRowNumbers,
        OrgImportPlannedAction plannedAction,
        OrgImportRowStatus rowStatus,
        List<String> errors,
        List<String> warnings
) {
    @SuppressWarnings("unchecked")
    public static OrgImportRowDto from(OrgImportBatchRow row) {
        Map<String, Object> data = row.getNormalizedData() == null ? Map.of() : row.getNormalizedData();
        List<Integer> srcRows = List.of(row.getRowNumber());
        Object rawSrc = data.get("sourceRowNumbers");
        if (rawSrc instanceof List<?> list && !list.isEmpty()) {
            srcRows = list.stream()
                    .filter(Number.class::isInstance)
                    .map(n -> ((Number) n).intValue())
                    .toList();
        }
        return new OrgImportRowDto(
                row.getId(),
                row.getRowNumber(),
                row.getEmployeeNumber(),
                str(data.get("fullName")),
                str(data.get("email")),
                str(data.get("gender")),
                str(data.get("parentDepartment")),
                str(data.get("department")),
                str(data.get("departmentCode")),
                str(data.get("job")),
                str(data.get("position")),
                str(data.get("managerEmployeeNumber")),
                str(data.get("employmentStatus")),
                srcRows,
                row.getPlannedAction(),
                row.getRowStatus(),
                row.getValidationErrors() == null ? List.of() : row.getValidationErrors(),
                row.getValidationWarnings() == null ? List.of() : row.getValidationWarnings()
        );
    }

    private static String str(Object o) {
        return o == null ? null : String.valueOf(o);
    }
}

