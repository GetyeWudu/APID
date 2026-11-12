package com.boa.apid.coaching.importpms.entity;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.Instant;

@Entity
@Table(name = "pms_report_batches", schema = "coaching")
public class PmsReportBatch {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "stored_file_id", nullable = false)
    private Long storedFileId;

    @Column(name = "file_name", nullable = false, length = 255)
    private String fileName;

    @Column(name = "file_sha256", nullable = false, length = 64)
    private String fileSha256;

    @Column(name = "performance_fiscal_quarter_id", nullable = false)
    private Long performanceFiscalQuarterId;

    @Column(name = "coaching_fiscal_quarter_id", nullable = false)
    private Long coachingFiscalQuarterId;

    @Column(name = "pms_year", nullable = false, length = 10)
    private String pmsYear;

    @Column(name = "pms_quarter", nullable = false)
    private Short pmsQuarter;

    @Column(name = "document_name", length = 255)
    private String documentName;

    @Column(name = "mandatory_cutoff_rounded", nullable = false)
    private Short mandatoryCutoffRounded = 3;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 20)
    private PmsBatchStatus status = PmsBatchStatus.PREVIEW;

    @Column(name = "total_source_rows", nullable = false)
    private int totalSourceRows = 0;

    @Column(name = "unique_employees_count", nullable = false)
    private int uniqueEmployeesCount = 0;

    @Column(name = "mandatory_below3_count", nullable = false)
    private int mandatoryBelow3Count = 0;

    @Column(name = "passing_count", nullable = false)
    private int passingCount = 0;

    @Column(name = "error_rows_count", nullable = false)
    private int errorRowsCount = 0;

    @Column(name = "warning_rows_count", nullable = false)
    private int warningRowsCount = 0;

    @Column(name = "uploaded_by_user_id", nullable = false)
    private Long uploadedByUserId;

    @Column(name = "committed_by_user_id")
    private Long committedByUserId;

    @Column(name = "expires_at", nullable = false)
    private Instant expiresAt;

    @Column(name = "committed_at")
    private Instant committedAt;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @PrePersist
    void onCreate() {
        this.createdAt = Instant.now();
    }

    // ---- Getters and Setters ----

    public Long getId() { return id; }
    public Long getStoredFileId() { return storedFileId; }
    public void setStoredFileId(Long storedFileId) { this.storedFileId = storedFileId; }
    public String getFileName() { return fileName; }
    public void setFileName(String fileName) { this.fileName = fileName; }
    public String getFileSha256() { return fileSha256; }
    public void setFileSha256(String fileSha256) { this.fileSha256 = fileSha256; }
    public Long getPerformanceFiscalQuarterId() { return performanceFiscalQuarterId; }
    public void setPerformanceFiscalQuarterId(Long id) { this.performanceFiscalQuarterId = id; }
    public Long getCoachingFiscalQuarterId() { return coachingFiscalQuarterId; }
    public void setCoachingFiscalQuarterId(Long id) { this.coachingFiscalQuarterId = id; }
    public String getPmsYear() { return pmsYear; }
    public void setPmsYear(String pmsYear) { this.pmsYear = pmsYear; }
    public Short getPmsQuarter() { return pmsQuarter; }
    public void setPmsQuarter(Short pmsQuarter) { this.pmsQuarter = pmsQuarter; }
    public String getDocumentName() { return documentName; }
    public void setDocumentName(String documentName) { this.documentName = documentName; }
    public Short getMandatoryCutoffRounded() { return mandatoryCutoffRounded; }
    public void setMandatoryCutoffRounded(Short mandatoryCutoffRounded) { this.mandatoryCutoffRounded = mandatoryCutoffRounded; }
    public PmsBatchStatus getStatus() { return status; }
    public void setStatus(PmsBatchStatus status) { this.status = status; }
    public int getTotalSourceRows() { return totalSourceRows; }
    public void setTotalSourceRows(int totalSourceRows) { this.totalSourceRows = totalSourceRows; }
    public int getUniqueEmployeesCount() { return uniqueEmployeesCount; }
    public void setUniqueEmployeesCount(int uniqueEmployeesCount) { this.uniqueEmployeesCount = uniqueEmployeesCount; }
    public int getMandatoryBelow3Count() { return mandatoryBelow3Count; }
    public void setMandatoryBelow3Count(int mandatoryBelow3Count) { this.mandatoryBelow3Count = mandatoryBelow3Count; }
    public int getPassingCount() { return passingCount; }
    public void setPassingCount(int passingCount) { this.passingCount = passingCount; }
    public int getErrorRowsCount() { return errorRowsCount; }
    public void setErrorRowsCount(int errorRowsCount) { this.errorRowsCount = errorRowsCount; }
    public int getWarningRowsCount() { return warningRowsCount; }
    public void setWarningRowsCount(int warningRowsCount) { this.warningRowsCount = warningRowsCount; }
    public Long getUploadedByUserId() { return uploadedByUserId; }
    public void setUploadedByUserId(Long uploadedByUserId) { this.uploadedByUserId = uploadedByUserId; }
    public Long getCommittedByUserId() { return committedByUserId; }
    public void setCommittedByUserId(Long committedByUserId) { this.committedByUserId = committedByUserId; }
    public Instant getExpiresAt() { return expiresAt; }
    public void setExpiresAt(Instant expiresAt) { this.expiresAt = expiresAt; }
    public Instant getCommittedAt() { return committedAt; }
    public void setCommittedAt(Instant committedAt) { this.committedAt = committedAt; }
    public Instant getCreatedAt() { return createdAt; }
}

