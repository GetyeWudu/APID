package com.boa.apid.core.organization.entity;

import jakarta.persistence.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Entity
@Table(name = "org_import_batches", schema = "core")
public class OrgImportBatch {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "uploaded_by_user_id", nullable = false)
    private Long uploadedByUserId;

    @Column(name = "file_name", nullable = false, length = 255)
    private String fileName;

    @Column(name = "file_hash", nullable = false, length = 64)
    private String fileHash;

    @Column(name = "file_format", nullable = false, length = 20)
    private String fileFormat;

    @Column(name = "detected_schema", nullable = false, length = 40)
    private String detectedSchema;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "column_presence_json", nullable = false, columnDefinition = "jsonb")
    private Map<String, Boolean> columnPresenceJson = new LinkedHashMap<>();

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 30)
    private OrgImportBatchStatus status = OrgImportBatchStatus.PREVIEWED;

    @Column(name = "total_source_rows", nullable = false)
    private int totalSourceRows;

    @Column(name = "unique_employees", nullable = false)
    private int uniqueEmployees;

    @Column(name = "duplicate_rows_collapsed", nullable = false)
    private int duplicateRowsCollapsed;

    @Column(name = "employees_to_create", nullable = false)
    private int employeesToCreate;

    @Column(name = "employees_to_update", nullable = false)
    private int employeesToUpdate;

    @Column(name = "departments_to_create", nullable = false)
    private int departmentsToCreate;

    @Column(name = "managers_to_link", nullable = false)
    private int managersToLink;

    @Column(name = "error_rows", nullable = false)
    private int errorRows;

    @Column(name = "warning_rows", nullable = false)
    private int warningRows;

    @Column(name = "employees_created", nullable = false)
    private int employeesCreated;

    @Column(name = "employees_updated", nullable = false)
    private int employeesUpdated;

    @Column(name = "departments_created", nullable = false)
    private int departmentsCreated;

    @Column(name = "managers_linked", nullable = false)
    private int managersLinked;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "summary_warnings_json", nullable = false, columnDefinition = "jsonb")
    private List<String> summaryWarningsJson = new ArrayList<>();

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "expires_at", nullable = false)
    private Instant expiresAt;

    @Column(name = "committed_at")
    private Instant committedAt;

    @PrePersist
    void onCreate() {
        if (this.createdAt == null) {
            this.createdAt = Instant.now();
        }
    }

    public Long getId() { return id; }
    public Long getUploadedByUserId() { return uploadedByUserId; }
    public void setUploadedByUserId(Long uploadedByUserId) { this.uploadedByUserId = uploadedByUserId; }
    public String getFileName() { return fileName; }
    public void setFileName(String fileName) { this.fileName = fileName; }
    public String getFileHash() { return fileHash; }
    public void setFileHash(String fileHash) { this.fileHash = fileHash; }
    public String getFileFormat() { return fileFormat; }
    public void setFileFormat(String fileFormat) { this.fileFormat = fileFormat; }
    public String getDetectedSchema() { return detectedSchema; }
    public void setDetectedSchema(String detectedSchema) { this.detectedSchema = detectedSchema; }
    public Map<String, Boolean> getColumnPresenceJson() { return columnPresenceJson; }
    public void setColumnPresenceJson(Map<String, Boolean> columnPresenceJson) { this.columnPresenceJson = columnPresenceJson; }
    public OrgImportBatchStatus getStatus() { return status; }
    public void setStatus(OrgImportBatchStatus status) { this.status = status; }
    public int getTotalSourceRows() { return totalSourceRows; }
    public void setTotalSourceRows(int totalSourceRows) { this.totalSourceRows = totalSourceRows; }
    public int getUniqueEmployees() { return uniqueEmployees; }
    public void setUniqueEmployees(int uniqueEmployees) { this.uniqueEmployees = uniqueEmployees; }
    public int getDuplicateRowsCollapsed() { return duplicateRowsCollapsed; }
    public void setDuplicateRowsCollapsed(int duplicateRowsCollapsed) { this.duplicateRowsCollapsed = duplicateRowsCollapsed; }
    public int getEmployeesToCreate() { return employeesToCreate; }
    public void setEmployeesToCreate(int employeesToCreate) { this.employeesToCreate = employeesToCreate; }
    public int getEmployeesToUpdate() { return employeesToUpdate; }
    public void setEmployeesToUpdate(int employeesToUpdate) { this.employeesToUpdate = employeesToUpdate; }
    public int getDepartmentsToCreate() { return departmentsToCreate; }
    public void setDepartmentsToCreate(int departmentsToCreate) { this.departmentsToCreate = departmentsToCreate; }
    public int getManagersToLink() { return managersToLink; }
    public void setManagersToLink(int managersToLink) { this.managersToLink = managersToLink; }
    public int getErrorRows() { return errorRows; }
    public void setErrorRows(int errorRows) { this.errorRows = errorRows; }
    public int getWarningRows() { return warningRows; }
    public void setWarningRows(int warningRows) { this.warningRows = warningRows; }
    public int getEmployeesCreated() { return employeesCreated; }
    public void setEmployeesCreated(int employeesCreated) { this.employeesCreated = employeesCreated; }
    public int getEmployeesUpdated() { return employeesUpdated; }
    public void setEmployeesUpdated(int employeesUpdated) { this.employeesUpdated = employeesUpdated; }
    public int getDepartmentsCreated() { return departmentsCreated; }
    public void setDepartmentsCreated(int departmentsCreated) { this.departmentsCreated = departmentsCreated; }
    public int getManagersLinked() { return managersLinked; }
    public void setManagersLinked(int managersLinked) { this.managersLinked = managersLinked; }
    public List<String> getSummaryWarningsJson() { return summaryWarningsJson; }
    public void setSummaryWarningsJson(List<String> summaryWarningsJson) { this.summaryWarningsJson = summaryWarningsJson; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getExpiresAt() { return expiresAt; }
    public void setExpiresAt(Instant expiresAt) { this.expiresAt = expiresAt; }
    public Instant getCommittedAt() { return committedAt; }
    public void setCommittedAt(Instant committedAt) { this.committedAt = committedAt; }
}

