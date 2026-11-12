package com.boa.apid.coaching.importpms.entity;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.Instant;

@Entity
@Table(name = "pms_performance_records", schema = "coaching")
public class PmsPerformanceRecord {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "batch_id", nullable = false)
    private Long batchId;

    @Column(name = "employee_id", nullable = false)
    private Long employeeId;

    @Column(name = "performance_fiscal_quarter_id", nullable = false)
    private Long performanceFiscalQuarterId;

    @Column(name = "pms_year", nullable = false, length = 10)
    private String pmsYear;

    @Column(name = "pms_quarter", nullable = false)
    private Short pmsQuarter;

    @Column(name = "evaluation_status", length = 50)
    private String evaluationStatus;

    @Column(name = "overall_final_rating", nullable = false, precision = 8, scale = 4)
    private BigDecimal overallFinalRating;

    @Column(name = "rounded_overall_final_rating", nullable = false)
    private Short roundedOverallFinalRating;

    @Column(name = "mandatory_coaching_triggered", nullable = false)
    private boolean mandatoryCoachingTriggered = false;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @PrePersist
    void onCreate() { this.createdAt = Instant.now(); }

    // ---- Getters and Setters ----

    public Long getId() { return id; }
    public Long getBatchId() { return batchId; }
    public void setBatchId(Long batchId) { this.batchId = batchId; }
    public Long getEmployeeId() { return employeeId; }
    public void setEmployeeId(Long employeeId) { this.employeeId = employeeId; }
    public Long getPerformanceFiscalQuarterId() { return performanceFiscalQuarterId; }
    public void setPerformanceFiscalQuarterId(Long performanceFiscalQuarterId) { this.performanceFiscalQuarterId = performanceFiscalQuarterId; }
    public String getPmsYear() { return pmsYear; }
    public void setPmsYear(String pmsYear) { this.pmsYear = pmsYear; }
    public Short getPmsQuarter() { return pmsQuarter; }
    public void setPmsQuarter(Short pmsQuarter) { this.pmsQuarter = pmsQuarter; }
    public String getEvaluationStatus() { return evaluationStatus; }
    public void setEvaluationStatus(String evaluationStatus) { this.evaluationStatus = evaluationStatus; }
    public BigDecimal getOverallFinalRating() { return overallFinalRating; }
    public void setOverallFinalRating(BigDecimal overallFinalRating) { this.overallFinalRating = overallFinalRating; }
    public Short getRoundedOverallFinalRating() { return roundedOverallFinalRating; }
    public void setRoundedOverallFinalRating(Short roundedOverallFinalRating) { this.roundedOverallFinalRating = roundedOverallFinalRating; }
    public boolean isMandatoryCoachingTriggered() { return mandatoryCoachingTriggered; }
    public void setMandatoryCoachingTriggered(boolean mandatoryCoachingTriggered) { this.mandatoryCoachingTriggered = mandatoryCoachingTriggered; }
    public Instant getCreatedAt() { return createdAt; }
}

