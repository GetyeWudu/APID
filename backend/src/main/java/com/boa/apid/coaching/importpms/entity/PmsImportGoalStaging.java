package com.boa.apid.coaching.importpms.entity;

import jakarta.persistence.*;
import java.math.BigDecimal;

@Entity
@Table(name = "pms_import_goal_staging", schema = "coaching")
public class PmsImportGoalStaging {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "employee_staging_id")
    private Long employeeStagingId;

    @Column(name = "source_row_number", nullable = false)
    private int sourceRowNumber;

    @Column(name = "goal_name", nullable = false, length = 255)
    private String goalName;

    @Column(name = "goal_tracking_name", length = 255)
    private String goalTrackingName;

    @Column(name = "target_value", length = 100)
    private String targetValue;

    @Column(name = "actual_value", length = 100)
    private String actualValue;

    @Column(name = "goal_score", precision = 8, scale = 4)
    private BigDecimal goalScore;

    @Column(name = "weight", precision = 6, scale = 2)
    private BigDecimal weight;

    @Column(name = "line_score", precision = 8, scale = 4)
    private BigDecimal lineScore;

    // ---- Getters and Setters ----

    public Long getId() { return id; }
    public Long getEmployeeStagingId() { return employeeStagingId; }
    public void setEmployeeStagingId(Long employeeStagingId) { this.employeeStagingId = employeeStagingId; }
    public int getSourceRowNumber() { return sourceRowNumber; }
    public void setSourceRowNumber(int sourceRowNumber) { this.sourceRowNumber = sourceRowNumber; }
    public String getGoalName() { return goalName; }
    public void setGoalName(String goalName) { this.goalName = goalName; }
    public String getGoalTrackingName() { return goalTrackingName; }
    public void setGoalTrackingName(String goalTrackingName) { this.goalTrackingName = goalTrackingName; }
    public String getTargetValue() { return targetValue; }
    public void setTargetValue(String targetValue) { this.targetValue = targetValue; }
    public String getActualValue() { return actualValue; }
    public void setActualValue(String actualValue) { this.actualValue = actualValue; }
    public BigDecimal getGoalScore() { return goalScore; }
    public void setGoalScore(BigDecimal goalScore) { this.goalScore = goalScore; }
    public BigDecimal getWeight() { return weight; }
    public void setWeight(BigDecimal weight) { this.weight = weight; }
    public BigDecimal getLineScore() { return lineScore; }
    public void setLineScore(BigDecimal lineScore) { this.lineScore = lineScore; }
}

