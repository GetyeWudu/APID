package com.boa.apid.coaching.assignment.dto;

import com.boa.apid.coaching.importpms.dto.PmsGoalLineDto;

import java.math.BigDecimal;
import java.util.List;

public record EmployeePerformanceGoalsDto(
        Long employeeId,
        String employeeNumber,
        String fullName,
        String departmentName,
        String position,
        String pmsYear,
        Short pmsQuarter,
        String coachingQuarterLabel,
        BigDecimal overallFinalRating,
        Short roundedOverallFinalRating,
        boolean mandatoryCoachingTriggered,
        List<PmsGoalLineDto> goalLines
) {}

