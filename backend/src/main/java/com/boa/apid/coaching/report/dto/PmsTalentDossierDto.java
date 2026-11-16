package com.boa.apid.coaching.report.dto;

import com.boa.apid.coaching.session.entity.CoachAssessment;

import java.math.BigDecimal;
import java.util.List;

public record PmsTalentDossierDto(
        Long assignmentId,
        Long coacheeEmployeeId,
        String coacheeStaffId,
        String coacheeName,
        String department,
        String directorate,
        String jobTitle,
        String email,

        // Baseline Appraisal Information
        String fiscalQuarterName,
        BigDecimal startingRating,
        String ratingBand,
        String targetWeaknessKpi,
        String weaknessRootCause,
        String targetScore,
        String actualScore,

        // Coach Information
        Long coachEmployeeId,
        String coachStaffId,
        String coachName,
        String coachEmail,

        // Target Commitment & Governance
        int policyBaseline,
        int approvedTarget,
        int completedSessions,
        int remainingSessions,
        double deliveryPercentage,
        String targetStatus,
        boolean isExtensionApproved,
        int extensionSessionsAdded,

        // Overall Progress Trajectory
        CoachAssessment latestAssessment,
        String progressTrajectory,
        boolean attentionRequired,
        String attentionReason,

        // Two-Way Session-by-Session Progress Log
        List<SessionProgressLogDto> sessionLogs
) {}

