package com.boa.apid.coaching.report.dto;

public record TopCoachRatingDto(
        Long coachEmployeeId,
        String coachName,
        String coachStaffId,
        String department,
        String district,
        Double averageRating,
        Integer totalRatings,
        Integer completedSessions,
        Integer activeCoachees,
        String excellenceBadge
) {}
