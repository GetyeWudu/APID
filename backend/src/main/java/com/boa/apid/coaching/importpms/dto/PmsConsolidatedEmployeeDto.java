package com.boa.apid.coaching.importpms.dto;

import com.boa.apid.coaching.importpms.entity.PmsImportPlannedAction;
import com.boa.apid.coaching.importpms.entity.PmsImportValidationStatus;

import java.math.BigDecimal;
import java.util.List;

public record PmsConsolidatedEmployeeDto(
        Long stagingId,
        String employeeNumber,
        String resolvedFullName,
        String department,
        String coachFullName,
        BigDecimal overallFinalRating,
        int roundedOverallFinalRating,
        int goalCount,
        String evaluationStatus,
        PmsImportValidationStatus validationStatus,
        PmsImportPlannedAction plannedAction,
        boolean hasCoacheePortalAccount,
        boolean hasCoachPortalAccount,
        List<String> errors,
        List<String> warnings,
        List<PmsGoalLineDto> goalLines
) {}

