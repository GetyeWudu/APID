package com.boa.apid.coaching.importpms.entity;

import jakarta.persistence.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

@Entity
@Table(name = "pms_import_employee_staging", schema = "coaching")
public class PmsImportEmployeeStaging {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "batch_id", nullable = false)
    private Long batchId;

    @Column(name = "source_row_number", nullable = false)
    private int sourceRowNumber;

    @Column(name = "employee_number", nullable = false, length = 60)
    private String employeeNumber;

    @Column(name = "pms_full_name", length = 200)
    private String pmsFullName;

    @Column(name = "pms_email", length = 200)
    private String pmsEmail;

    @Column(name = "pms_department", length = 200)
    private String pmsDepartment;

    @Column(name = "pms_job", length = 200)
    private String pmsJob;

    @Column(name = "pms_position", length = 200)
    private String pmsPosition;

    @Column(name = "resolved_employee_id")
    private Long resolvedEmployeeId;

    @Column(name = "resolved_manager_employee_id")
    private Long resolvedManagerEmployeeId;

    @Column(name = "has_coachee_portal_account", nullable = false)
    private boolean hasCoacheePortalAccount = false;

    @Column(name = "has_coach_portal_account", nullable = false)
    private boolean hasCoachPortalAccount = false;

    @Column(name = "evaluation_status", length = 50)
    private String evaluationStatus;

    @Column(name = "overall_final_rating", precision = 8, scale = 4)
    private BigDecimal overallFinalRating;

    @Column(name = "rounded_overall_final_rating", nullable = false)
    private Short roundedOverallFinalRating;

    @Column(name = "goal_count", nullable = false)
    private int goalCount = 1;

    @Enumerated(EnumType.STRING)
    @Column(name = "validation_status", nullable = false, length = 20)
    private PmsImportValidationStatus validationStatus;

    @Enumerated(EnumType.STRING)
    @Column(name = "planned_action", nullable = false, length = 30)
    private PmsImportPlannedAction plannedAction;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "errors_json", columnDefinition = "jsonb")
    private List<String> errors;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "warnings_json", columnDefinition = "jsonb")
    private List<String> warnings;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @OneToMany(cascade = CascadeType.ALL, orphanRemoval = true)
    @JoinColumn(name = "employee_staging_id")
    private List<PmsImportGoalStaging> goalLines;

    @PrePersist
    void onCreate() { this.createdAt = Instant.now(); }

    // ---- Getters and Setters ----

    public Long getId() { return id; }
    public Long getBatchId() { return batchId; }
    public void setBatchId(Long batchId) { this.batchId = batchId; }
    public int getSourceRowNumber() { return sourceRowNumber; }
    public void setSourceRowNumber(int sourceRowNumber) { this.sourceRowNumber = sourceRowNumber; }
    public String getEmployeeNumber() { return employeeNumber; }
    public void setEmployeeNumber(String employeeNumber) { this.employeeNumber = employeeNumber; }
    public String getPmsFullName() { return pmsFullName; }
    public void setPmsFullName(String pmsFullName) { this.pmsFullName = pmsFullName; }
    public String getPmsEmail() { return pmsEmail; }
    public void setPmsEmail(String pmsEmail) { this.pmsEmail = pmsEmail; }
    public String getPmsDepartment() { return pmsDepartment; }
    public void setPmsDepartment(String pmsDepartment) { this.pmsDepartment = pmsDepartment; }
    public String getPmsJob() { return pmsJob; }
    public void setPmsJob(String pmsJob) { this.pmsJob = pmsJob; }
    public String getPmsPosition() { return pmsPosition; }
    public void setPmsPosition(String pmsPosition) { this.pmsPosition = pmsPosition; }
    public Long getResolvedEmployeeId() { return resolvedEmployeeId; }
    public void setResolvedEmployeeId(Long resolvedEmployeeId) { this.resolvedEmployeeId = resolvedEmployeeId; }
    public Long getResolvedManagerEmployeeId() { return resolvedManagerEmployeeId; }
    public void setResolvedManagerEmployeeId(Long resolvedManagerEmployeeId) { this.resolvedManagerEmployeeId = resolvedManagerEmployeeId; }
    public boolean isHasCoacheePortalAccount() { return hasCoacheePortalAccount; }
    public void setHasCoacheePortalAccount(boolean hasCoacheePortalAccount) { this.hasCoacheePortalAccount = hasCoacheePortalAccount; }
    public boolean isHasCoachPortalAccount() { return hasCoachPortalAccount; }
    public void setHasCoachPortalAccount(boolean hasCoachPortalAccount) { this.hasCoachPortalAccount = hasCoachPortalAccount; }
    public String getEvaluationStatus() { return evaluationStatus; }
    public void setEvaluationStatus(String evaluationStatus) { this.evaluationStatus = evaluationStatus; }
    public BigDecimal getOverallFinalRating() { return overallFinalRating; }
    public void setOverallFinalRating(BigDecimal overallFinalRating) { this.overallFinalRating = overallFinalRating; }
    public Short getRoundedOverallFinalRating() { return roundedOverallFinalRating; }
    public void setRoundedOverallFinalRating(Short roundedOverallFinalRating) { this.roundedOverallFinalRating = roundedOverallFinalRating; }
    public int getGoalCount() { return goalCount; }
    public void setGoalCount(int goalCount) { this.goalCount = goalCount; }
    public PmsImportValidationStatus getValidationStatus() { return validationStatus; }
    public void setValidationStatus(PmsImportValidationStatus validationStatus) { this.validationStatus = validationStatus; }
    public PmsImportPlannedAction getPlannedAction() { return plannedAction; }
    public void setPlannedAction(PmsImportPlannedAction plannedAction) { this.plannedAction = plannedAction; }
    public List<String> getErrors() { return errors; }
    public void setErrors(List<String> errors) { this.errors = errors; }
    public List<String> getWarnings() { return warnings; }
    public void setWarnings(List<String> warnings) { this.warnings = warnings; }
    public List<PmsImportGoalStaging> getGoalLines() { return goalLines; }
    public void setGoalLines(List<PmsImportGoalStaging> goalLines) { this.goalLines = goalLines; }
    public Instant getCreatedAt() { return createdAt; }
}

