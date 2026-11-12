package com.boa.apid.core.config.dto;

import com.boa.apid.core.config.entity.FiscalQuarter;

import java.time.Instant;
import java.time.LocalDate;

public record FiscalQuarterDto(
        Long id,
        String fiscalYear,
        Integer quarter,
        String label,
        LocalDate startDate,
        LocalDate endDate,
        boolean active,
        boolean locked,
        boolean referencedByRecords,
        Instant createdAt,
        Instant updatedAt
) {
    public static FiscalQuarterDto from(FiscalQuarter fq, boolean referenced) {
        return new FiscalQuarterDto(
                fq.getId(),
                fq.getFiscalYear(),
                fq.getQuarter() != null ? fq.getQuarter().intValue() : null,
                fq.getLabel(),
                fq.getStartDate(),
                fq.getEndDate(),
                fq.isActive(),
                fq.isLocked(),
                referenced,
                fq.getCreatedAt(),
                fq.getUpdatedAt()
        );
    }
}

