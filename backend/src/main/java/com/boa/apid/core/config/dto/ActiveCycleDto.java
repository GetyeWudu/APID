package com.boa.apid.core.config.dto;

import com.boa.apid.core.config.entity.FiscalQuarter;

import java.time.LocalDate;

/**
 * Non-final DTO with public no-arg constructor for Redis DefaultTyping.NON_FINAL serialization.
 */
public class ActiveCycleDto {

    private Long quarterId;
    private String fiscalYear;
    private Integer quarter;
    private String label;
    private LocalDate startDate;
    private LocalDate endDate;

    public ActiveCycleDto() {
    }

    public ActiveCycleDto(
            Long quarterId,
            String fiscalYear,
            Integer quarter,
            String label,
            LocalDate startDate,
            LocalDate endDate
    ) {
        this.quarterId = quarterId;
        this.fiscalYear = fiscalYear;
        this.quarter = quarter;
        this.label = label;
        this.startDate = startDate;
        this.endDate = endDate;
    }

    public static ActiveCycleDto from(FiscalQuarter fq) {
        return new ActiveCycleDto(
                fq.getId(),
                fq.getFiscalYear(),
                fq.getQuarter() != null ? fq.getQuarter().intValue() : null,
                fq.getLabel(),
                fq.getStartDate(),
                fq.getEndDate()
        );
    }

    public Long getQuarterId() { return quarterId; }
    public void setQuarterId(Long quarterId) { this.quarterId = quarterId; }
    public String getFiscalYear() { return fiscalYear; }
    public void setFiscalYear(String fiscalYear) { this.fiscalYear = fiscalYear; }
    public Integer getQuarter() { return quarter; }
    public void setQuarter(Integer quarter) { this.quarter = quarter; }
    public String getLabel() { return label; }
    public void setLabel(String label) { this.label = label; }
    public LocalDate getStartDate() { return startDate; }
    public void setStartDate(LocalDate startDate) { this.startDate = startDate; }
    public LocalDate getEndDate() { return endDate; }
    public void setEndDate(LocalDate endDate) { this.endDate = endDate; }
}

