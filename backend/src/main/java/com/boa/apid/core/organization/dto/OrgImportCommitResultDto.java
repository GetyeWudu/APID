package com.boa.apid.core.organization.dto;

import com.boa.apid.core.organization.entity.OrgImportBatch;
import com.boa.apid.core.organization.entity.OrgImportBatchStatus;

import java.time.Instant;
import java.util.List;

public record OrgImportCommitResultDto(
        Long batchId,
        OrgImportBatchStatus status,
        String fileFormat,
        String detectedSchema,
        boolean managerColumnDetected,
        int totalSourceRows,
        int uniqueEmployees,
        int duplicateRowsCollapsed,
        int employeesCreated,
        int employeesUpdated,
        int departmentsCreated,
        int managersLinked,
        List<String> summaryWarnings,
        Instant committedAt
) {
    public static OrgImportCommitResultDto from(OrgImportBatch batch) {
        return new OrgImportCommitResultDto(
                batch.getId(),
                batch.getStatus(),
                batch.getFileFormat(),
                batch.getDetectedSchema(),
                batch.getColumnPresenceJson() != null
                        && Boolean.TRUE.equals(batch.getColumnPresenceJson().get("managerEmployeeNumber")),
                batch.getTotalSourceRows(),
                batch.getUniqueEmployees(),
                batch.getDuplicateRowsCollapsed(),
                batch.getEmployeesCreated(),
                batch.getEmployeesUpdated(),
                batch.getDepartmentsCreated(),
                batch.getManagersLinked(),
                batch.getSummaryWarningsJson() == null ? List.of() : batch.getSummaryWarningsJson(),
                batch.getCommittedAt()
        );
    }
}
