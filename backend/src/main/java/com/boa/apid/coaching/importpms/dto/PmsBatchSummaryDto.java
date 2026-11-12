package com.boa.apid.coaching.importpms.dto;

import com.boa.apid.coaching.importpms.entity.PmsBatchStatus;

import java.time.Instant;

public record PmsBatchSummaryDto(
        Long id,
        String fileName,
        String fileSha256Short,
        String performanceQuarterLabel,
        String coachingQuarterLabel,
        String pmsYear,
        int pmsQuarter,
        PmsBatchStatus status,
        int totalSourceRows,
        int uniqueEmployeesCount,
        int mandatoryBelow3Count,
        int passingCount,
        int errorRowsCount,
        int warningRowsCount,
        Instant expiresAt,
        Instant committedAt,
        Instant createdAt
) {}

