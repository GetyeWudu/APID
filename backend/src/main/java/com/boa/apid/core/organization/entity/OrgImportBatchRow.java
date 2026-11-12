package com.boa.apid.core.organization.entity;

import jakarta.persistence.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Entity
@Table(name = "org_import_batch_rows", schema = "core")
public class OrgImportBatchRow {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "batch_id", nullable = false)
    private Long batchId;

    @Column(name = "row_number", nullable = false)
    private int rowNumber;

    @Column(name = "employee_number", length = 60)
    private String employeeNumber;

    @Enumerated(EnumType.STRING)
    @Column(name = "planned_action", nullable = false, length = 20)
    private OrgImportPlannedAction plannedAction;

    @Enumerated(EnumType.STRING)
    @Column(name = "row_status", nullable = false, length = 20)
    private OrgImportRowStatus rowStatus;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "normalized_data", nullable = false, columnDefinition = "jsonb")
    private Map<String, Object> normalizedData = new LinkedHashMap<>();

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "validation_errors", nullable = false, columnDefinition = "jsonb")
    private List<String> validationErrors = new ArrayList<>();

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "validation_warnings", nullable = false, columnDefinition = "jsonb")
    private List<String> validationWarnings = new ArrayList<>();

    public Long getId() { return id; }
    public Long getBatchId() { return batchId; }
    public void setBatchId(Long batchId) { this.batchId = batchId; }
    public int getRowNumber() { return rowNumber; }
    public void setRowNumber(int rowNumber) { this.rowNumber = rowNumber; }
    public String getEmployeeNumber() { return employeeNumber; }
    public void setEmployeeNumber(String employeeNumber) { this.employeeNumber = employeeNumber; }
    public OrgImportPlannedAction getPlannedAction() { return plannedAction; }
    public void setPlannedAction(OrgImportPlannedAction plannedAction) { this.plannedAction = plannedAction; }
    public OrgImportRowStatus getRowStatus() { return rowStatus; }
    public void setRowStatus(OrgImportRowStatus rowStatus) { this.rowStatus = rowStatus; }
    public Map<String, Object> getNormalizedData() { return normalizedData; }
    public void setNormalizedData(Map<String, Object> normalizedData) { this.normalizedData = normalizedData; }
    public List<String> getValidationErrors() { return validationErrors; }
    public void setValidationErrors(List<String> validationErrors) { this.validationErrors = validationErrors; }
    public List<String> getValidationWarnings() { return validationWarnings; }
    public void setValidationWarnings(List<String> validationWarnings) { this.validationWarnings = validationWarnings; }
}

