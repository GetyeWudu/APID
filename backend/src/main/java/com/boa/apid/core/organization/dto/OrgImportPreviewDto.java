package com.boa.apid.core.organization.dto;

import com.boa.apid.core.organization.entity.OrgImportBatch;
import com.boa.apid.core.organization.entity.OrgImportBatchStatus;
import org.springframework.data.domain.Page;

import java.time.Instant;
import java.util.List;
import java.util.Map;

public record OrgImportPreviewDto(
        Long batchId,
        String fileName,
        String fileFormat,
        String detectedSchema,
        OrgImportBatchStatus status,
        boolean expired,
        boolean managerColumnDetected,
        Map<String, Boolean> columnPresence,
        int totalSourceRows,
        int uniqueEmployees,
        int duplicateRowsCollapsed,
        int employeesToCreate,
        int employeesToUpdate,
        int departmentsToCreate,
        int managersToLink,
        int errorRows,
        int warningRows,
        int employeesCreated,
        int employeesUpdated,
        int departmentsCreated,
        int managersLinked,
        List<String> summaryWarnings,
        Instant createdAt,
        Instant expiresAt,
        Instant committedAt,
        Page<OrgImportRowDto> rows
) {
    public static OrgImportPreviewDto from(OrgImportBatch batch, Page<OrgImportRowDto> rows) {
        boolean isExpired = batch.getStatus() == OrgImportBatchStatus.EXPIRED
                || (batch.getStatus() == OrgImportBatchStatus.PREVIEWED && Instant.now().isAfter(batch.getExpiresAt()));
        Map<String, Boolean> presence = batch.getColumnPresenceJson() == null ? Map.of() : batch.getColumnPresenceJson();
        return new OrgImportPreviewDto(
                batch.getId(),
                batch.getFileName(),
                batch.getFileFormat(),
                batch.getDetectedSchema(),
                batch.getStatus(),
                isExpired,
                Boolean.TRUE.equals(presence.get("managerEmployeeNumber")),
                presence,
                batch.getTotalSourceRows(),
                batch.getUniqueEmployees(),
                batch.getDuplicateRowsCollapsed(),
                batch.getEmployeesToCreate(),
                batch.getEmployeesToUpdate(),
                batch.getDepartmentsToCreate(),
                batch.getManagersToLink(),
                batch.getErrorRows(),
                batch.getWarningRows(),
                batch.getEmployeesCreated(),
                batch.getEmployeesUpdated(),
                batch.getDepartmentsCreated(),
                batch.getManagersLinked(),
                batch.getSummaryWarningsJson() == null ? List.of() : batch.getSummaryWarningsJson(),
                batch.getCreatedAt(),
                batch.getExpiresAt(),
                batch.getCommittedAt(),
                rows
        );
    }
}

