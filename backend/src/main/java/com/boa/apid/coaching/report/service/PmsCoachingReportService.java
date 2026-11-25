package com.boa.apid.coaching.report.service;

import com.boa.apid.coaching.assignment.entity.AssignmentPathway;
import com.boa.apid.coaching.assignment.entity.AssignmentStatus;
import com.boa.apid.coaching.assignment.entity.CoachingAssignment;
import com.boa.apid.coaching.assignment.repository.CoachingAssignmentRepository;
import com.boa.apid.coaching.governance.entity.AdjustmentDecision;
import com.boa.apid.coaching.governance.entity.AdjustmentType;
import com.boa.apid.coaching.governance.entity.CoachingSessionTarget;
import com.boa.apid.coaching.governance.entity.CoachingTargetAdjustment;
import com.boa.apid.coaching.governance.repository.CoachingSessionTargetRepository;
import com.boa.apid.coaching.governance.repository.CoachingTargetAdjustmentRepository;
import com.boa.apid.coaching.importpms.entity.PmsGoalLine;
import com.boa.apid.coaching.importpms.entity.PmsPerformanceRecord;
import com.boa.apid.coaching.importpms.repository.PmsGoalLineRepository;
import com.boa.apid.coaching.importpms.repository.PmsPerformanceRecordRepository;
import com.boa.apid.coaching.report.dto.*;
import com.boa.apid.coaching.session.entity.AttendanceStatus;
import com.boa.apid.coaching.session.entity.CoachAssessment;
import com.boa.apid.coaching.session.entity.CoachingSession;
import com.boa.apid.coaching.session.entity.ParticipantRole;
import com.boa.apid.coaching.session.entity.SessionParticipant;
import com.boa.apid.coaching.session.entity.SessionStatus;
import com.boa.apid.coaching.session.entity.CoachingSessionTurn;
import com.boa.apid.coaching.session.repository.CoachingSessionRepository;
import com.boa.apid.coaching.session.repository.CoachingSessionTurnRepository;
import com.boa.apid.coaching.session.repository.SessionParticipantRepository;
import com.boa.apid.common.exception.ResourceNotFoundException;
import com.boa.apid.core.config.entity.FiscalQuarter;
import com.boa.apid.core.config.repository.FiscalQuarterRepository;
import com.boa.apid.core.notifications.entity.NotificationModule;
import com.boa.apid.core.notifications.service.NotificationService;
import com.boa.apid.core.organization.entity.Employee;
import com.boa.apid.core.organization.repository.EmployeeRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.stream.Collectors;

@Service
@Transactional(readOnly = true)
public class PmsCoachingReportService {

    private static final Logger log = LoggerFactory.getLogger(PmsCoachingReportService.class);

    private final CoachingAssignmentRepository assignmentRepository;
    private final CoachingSessionRepository sessionRepository;
    private final SessionParticipantRepository participantRepository;
    private final CoachingSessionTargetRepository sessionTargetRepository;
    private final CoachingTargetAdjustmentRepository targetAdjustmentRepository;
    private final EmployeeRepository employeeRepository;
    private final PmsPerformanceRecordRepository performanceRecordRepository;
    private final PmsGoalLineRepository goalLineRepository;
    private final FiscalQuarterRepository fiscalQuarterRepository;
    private final CoachingSessionTurnRepository turnRepository;
    private final NotificationService notificationService;

    public PmsCoachingReportService(
            CoachingAssignmentRepository assignmentRepository,
            CoachingSessionRepository sessionRepository,
            SessionParticipantRepository participantRepository,
            CoachingSessionTargetRepository sessionTargetRepository,
            CoachingTargetAdjustmentRepository targetAdjustmentRepository,
            EmployeeRepository employeeRepository,
            PmsPerformanceRecordRepository performanceRecordRepository,
            PmsGoalLineRepository goalLineRepository,
            FiscalQuarterRepository fiscalQuarterRepository,
            CoachingSessionTurnRepository turnRepository,
            NotificationService notificationService) {
        this.assignmentRepository = assignmentRepository;
        this.sessionRepository = sessionRepository;
        this.participantRepository = participantRepository;
        this.sessionTargetRepository = sessionTargetRepository;
        this.targetAdjustmentRepository = targetAdjustmentRepository;
        this.employeeRepository = employeeRepository;
        this.performanceRecordRepository = performanceRecordRepository;
        this.goalLineRepository = goalLineRepository;
        this.fiscalQuarterRepository = fiscalQuarterRepository;
        this.turnRepository = turnRepository;
        this.notificationService = notificationService;
    }

    public PmsReportSummaryDto getReportSummary(Long quarterId) {
        FiscalQuarter quarter = resolveQuarter(quarterId);
        List<CoachingAssignment> assignments = loadAssignmentsForQuarter(quarter);

        long totalInRemediation = assignments.size();
        long criticalCount = 0;
        long moderateCount = 0;
        long masteredCount = 0;
        long onTrackCount = 0;
        long improvingCount = 0;
        long needsImprovementCount = 0;
        long notStartedCount = 0;
        int totalApprovedSessions = 0;
        int totalCompletedSessions = 0;
        long attentionRequiredCount = 0;

        Map<String, MutableDirectorateSummary> directorateMap = new HashMap<>();

        for (CoachingAssignment a : assignments) {
            Employee coachee = employeeRepository.findById(a.getCoacheeEmployeeId()).orElse(null);
            String directorate = (coachee != null && coachee.getParentDepartmentName() != null && !coachee.getParentDepartmentName().isBlank())
                    ? coachee.getParentDepartmentName()
                    : "Head Office";

            MutableDirectorateSummary dirSummary = directorateMap.computeIfAbsent(
                    directorate, d -> new MutableDirectorateSummary(d));
            dirSummary.totalCoached++;

            // Appraisal Rating Band
            PmsPerformanceRecord perf = resolvePerformanceRecord(a);
            BigDecimal rating = (perf != null && perf.getOverallFinalRating() != null)
                    ? perf.getOverallFinalRating()
                    : BigDecimal.valueOf(2.50);

            if (rating.compareTo(BigDecimal.valueOf(2.0)) < 0) {
                criticalCount++;
            } else {
                moderateCount++;
            }

            // Target
            CoachingSessionTarget target = sessionTargetRepository.findByAssignmentId(a.getId()).orElse(null);
            int approvedTarget = (target != null && target.getApprovedTarget() > 0)
                    ? target.getApprovedTarget()
                    : (rating.compareTo(BigDecimal.valueOf(2.0)) < 0 ? 10 : 6);
            totalApprovedSessions += approvedTarget;
            dirSummary.approvedSessions += approvedTarget;

            // Sessions (supports multi-coachee joint sessions via participant link)
            List<CoachingSession> sessions = sessionRepository.findAllSessionsForAssignment(a.getId());
            int completedSessions = 0;
            CoachAssessment latestAssessment = null;
            Instant lastCompletedDate = null;
            Instant nextScheduledDate = null;
            Instant now = Instant.now();
            int missedSessions = a.getMissedSessionsCount();

            for (CoachingSession s : sessions) {
                if (s.getStatus() == SessionStatus.COMPLETED) {
                    completedSessions++;
                    if (s.getConductedAt() != null && (lastCompletedDate == null || s.getConductedAt().isAfter(lastCompletedDate))) {
                        lastCompletedDate = s.getConductedAt();
                    }
                    // check coachee assessment
                    Optional<SessionParticipant> coacheePart = participantRepository.findBySessionIdAndEmployeeId(
                            s.getId(), a.getCoacheeEmployeeId());
                    if (coacheePart.isPresent() && coacheePart.get().getCoachAssessment() != null) {
                        latestAssessment = coacheePart.get().getCoachAssessment();
                    }
                } else if (s.getStatus() == SessionStatus.CONFIRMED || s.getStatus() == SessionStatus.PROPOSED) {
                    if (s.getScheduledStartTime().isAfter(now)) {
                        if (nextScheduledDate == null || s.getScheduledStartTime().isBefore(nextScheduledDate)) {
                            nextScheduledDate = s.getScheduledStartTime();
                        }
                    }
                }
            }

            totalCompletedSessions += completedSessions;
            dirSummary.completedSessions += completedSessions;

            // Trajectory
            String trajectory = determineTrajectory(latestAssessment, completedSessions);
            switch (trajectory) {
                case "MASTERED" -> {
                    masteredCount++;
                    dirSummary.showingImprovement++;
                }
                case "ON_TRACK" -> {
                    onTrackCount++;
                    dirSummary.showingImprovement++;
                }
                case "IMPROVING" -> {
                    improvingCount++;
                    dirSummary.showingImprovement++;
                }
                case "NEEDS_IMPROVEMENT" -> needsImprovementCount++;
                default -> notStartedCount++;
            }

            // Risk check
            int remaining = Math.max(0, approvedTarget - completedSessions);
            boolean attentionRequired = isAttentionRequired(
                    missedSessions, lastCompletedDate, nextScheduledDate, remaining, quarter);
            if (attentionRequired) {
                attentionRequiredCount++;
                dirSummary.atRiskCount++;
            }
        }

        long showingImprovementCount = masteredCount + onTrackCount + improvingCount;
        double sessionDeliveryRate = totalApprovedSessions > 0
                ? BigDecimal.valueOf(totalCompletedSessions * 100.0 / totalApprovedSessions)
                .setScale(1, RoundingMode.HALF_UP).doubleValue()
                : 0.0;

        List<DirectorateReportSummaryDto> directorateBreakdown = directorateMap.values().stream()
                .map(d -> new DirectorateReportSummaryDto(
                        d.directorate,
                        d.totalCoached,
                        d.showingImprovement,
                        d.approvedSessions,
                        d.completedSessions,
                        d.atRiskCount
                ))
                .sorted(Comparator.comparing(DirectorateReportSummaryDto::totalCoached).reversed())
                .collect(Collectors.toList());

        String quarterName = quarter != null
                ? "FY " + quarter.getFiscalYear() + " - Q" + quarter.getQuarter()
                : "All Active Quarters";

        return new PmsReportSummaryDto(
                quarterName,
                totalInRemediation,
                criticalCount,
                moderateCount,
                showingImprovementCount,
                masteredCount,
                onTrackCount,
                needsImprovementCount,
                notStartedCount,
                totalApprovedSessions,
                totalCompletedSessions,
                sessionDeliveryRate,
                attentionRequiredCount,
                directorateBreakdown
        );
    }

    public List<PmsTalentProgressItemDto> getTalentsProgress(
            Long quarterId,
            String directorateFilter,
            String statusFilter,
            Boolean attentionOnly,
            String search) {
        return getTalentsProgress(quarterId, directorateFilter, statusFilter, attentionOnly, search, null, null, null, null);
    }

    public List<PmsTalentProgressItemDto> getTalentsProgress(
            Long quarterId,
            String directorateFilter,
            String statusFilter,
            Boolean attentionOnly,
            String search,
            String branchFilter,
            String performanceBand,
            String sessionProgress,
            String kpiType) {

        FiscalQuarter quarter = resolveQuarter(quarterId);
        List<CoachingAssignment> assignments = loadAssignmentsForQuarter(quarter);
        List<PmsTalentProgressItemDto> items = new ArrayList<>();

        for (CoachingAssignment a : assignments) {
            Employee coachee = employeeRepository.findById(a.getCoacheeEmployeeId()).orElse(null);
            if (coachee == null) continue;

            String directorate = (coachee.getParentDepartmentName() != null && !coachee.getParentDepartmentName().isBlank())
                    ? coachee.getParentDepartmentName()
                    : "Head Office";

            if (directorateFilter != null && !directorateFilter.isBlank() && !directorateFilter.equalsIgnoreCase("ALL")) {
                String cleanDist = directorateFilter.trim().toLowerCase();
                String dirLower = directorate.toLowerCase();
                boolean matches = dirLower.equals(cleanDist)
                        || dirLower.contains(cleanDist)
                        || cleanDist.contains(dirLower);
                if (!matches) {
                    continue;
                }
            }

            if (branchFilter != null && !branchFilter.isBlank() && !branchFilter.equalsIgnoreCase("ALL")) {
                String branchName = coachee.getDepartmentName() != null ? coachee.getDepartmentName() : "";
                String cleanBr = branchFilter.trim().toLowerCase();
                String brLower = branchName.toLowerCase();
                boolean matches = brLower.equals(cleanBr)
                        || brLower.contains(cleanBr)
                        || cleanBr.contains(brLower);
                if (!matches) {
                    continue;
                }
            }

            Employee coach = a.getCoachEmployeeId() != null
                    ? employeeRepository.findById(a.getCoachEmployeeId()).orElse(null)
                    : null;
            String coachName = coach != null ? coach.getFullName() : "Unassigned";

            // Performance record & target weakness
            PmsPerformanceRecord perf = resolvePerformanceRecord(a);
            BigDecimal rating = (perf != null && perf.getOverallFinalRating() != null)
                    ? perf.getOverallFinalRating()
                    : BigDecimal.valueOf(2.50);
            String ratingBand = rating.compareTo(BigDecimal.valueOf(2.0)) < 0 ? "CRITICAL" : "MODERATE";

            if (performanceBand != null && !performanceBand.isBlank() && !performanceBand.equalsIgnoreCase("ALL")) {
                if (!ratingBand.equalsIgnoreCase(performanceBand.trim())) {
                    continue;
                }
            }

            String targetWeaknessKpi = resolveTargetWeakness(perf);

            // Targets
            CoachingSessionTarget target = sessionTargetRepository.findByAssignmentId(a.getId()).orElse(null);
            int approvedTarget = (target != null && target.getApprovedTarget() > 0)
                    ? target.getApprovedTarget()
                    : (rating.compareTo(BigDecimal.valueOf(2.0)) < 0 ? 10 : 6);

            // Sessions (supports multi-coachee joint sessions via participant link)
            List<CoachingSession> sessions = sessionRepository.findAllSessionsForAssignment(a.getId());
            int completedSessions = 0;
            int totalLoggedSessions = sessions.size();
            CoachAssessment latestAssessment = null;
            Instant lastSessionDate = null;
            Instant nextScheduledDate = null;
            Instant now = Instant.now();

            for (CoachingSession s : sessions) {
                if (s.getStatus() == SessionStatus.COMPLETED) {
                    completedSessions++;
                    if (s.getConductedAt() != null && (lastSessionDate == null || s.getConductedAt().isAfter(lastSessionDate))) {
                        lastSessionDate = s.getConductedAt();
                    }
                    Optional<SessionParticipant> coacheePart = participantRepository.findBySessionIdAndEmployeeId(
                            s.getId(), coachee.getId());
                    if (coacheePart.isPresent() && coacheePart.get().getCoachAssessment() != null) {
                        latestAssessment = coacheePart.get().getCoachAssessment();
                    }
                } else if (s.getStatus() == SessionStatus.CONFIRMED || s.getStatus() == SessionStatus.PROPOSED) {
                    if (s.getScheduledStartTime().isAfter(now)) {
                        if (nextScheduledDate == null || s.getScheduledStartTime().isBefore(nextScheduledDate)) {
                            nextScheduledDate = s.getScheduledStartTime();
                        }
                    }
                }
            }

            int remainingSessions = Math.max(0, approvedTarget - completedSessions);
            double deliveryPercentage = approvedTarget > 0
                    ? BigDecimal.valueOf(completedSessions * 100.0 / approvedTarget)
                    .setScale(1, RoundingMode.HALF_UP).doubleValue()
                    : 0.0;

            String trajectory = determineTrajectory(latestAssessment, completedSessions);

            int missedCount = a.getMissedSessionsCount();
            boolean attentionRequired = isAttentionRequired(
                    missedCount, lastSessionDate, nextScheduledDate, remainingSessions, quarter);
            String attentionReason = buildAttentionReason(
                    missedCount, lastSessionDate, remainingSessions, quarter);

            // Session Progress Filter
            if (sessionProgress != null && !sessionProgress.isBlank() && !sessionProgress.equalsIgnoreCase("ALL")) {
                String prog;
                if (completedSessions == 0) prog = "NOT_STARTED";
                else if (completedSessions >= approvedTarget) prog = "TARGET_MET";
                else prog = "IN_PROGRESS";
                if (!prog.equalsIgnoreCase(sessionProgress.trim())) {
                    continue;
                }
            }

            // KPI Type Filter
            if (kpiType != null && !kpiType.isBlank() && !kpiType.equalsIgnoreCase("ALL")) {
                if (kpiType.equalsIgnoreCase("CRITICAL")) {
                    if (!"CRITICAL".equalsIgnoreCase(ratingBand)) continue;
                } else if (kpiType.equalsIgnoreCase("MODERATE")) {
                    if (!"MODERATE".equalsIgnoreCase(ratingBand)) continue;
                } else if (kpiType.equalsIgnoreCase("OVERDUE") || kpiType.equalsIgnoreCase("ATTENTION")) {
                    if (!attentionRequired) continue;
                } else if (kpiType.equalsIgnoreCase("COMPLETED")) {
                    if (completedSessions < approvedTarget) continue;
                }
            }

            // Apply Filters
            if (attentionOnly != null && attentionOnly && !attentionRequired) {
                continue;
            }

            if (statusFilter != null && !statusFilter.isBlank() && !statusFilter.equalsIgnoreCase("ALL")) {
                if (statusFilter.equalsIgnoreCase("IMPROVING")) {
                    if (!trajectory.equals("IMPROVING") && !trajectory.equals("ON_TRACK") && !trajectory.equals("MASTERED")) {
                        continue;
                    }
                } else if (!trajectory.equalsIgnoreCase(statusFilter)) {
                    continue;
                }
            }

            if (search != null && !search.isBlank()) {
                String q = search.toLowerCase().trim();
                boolean matches = coachee.getFullName().toLowerCase().contains(q)
                        || (coachee.getEmployeeNumber() != null && coachee.getEmployeeNumber().toLowerCase().contains(q))
                        || coachName.toLowerCase().contains(q)
                        || (coachee.getDepartmentName() != null && coachee.getDepartmentName().toLowerCase().contains(q));
                if (!matches) {
                    continue;
                }
            }

            items.add(new PmsTalentProgressItemDto(
                    a.getId(),
                    coachee.getId(),
                    coachee.getEmployeeNumber(),
                    coachee.getFullName(),
                    coachee.getDepartmentName() != null ? coachee.getDepartmentName() : "General Banking",
                    directorate,
                    rating,
                    ratingBand,
                    targetWeaknessKpi,
                    a.getCoachEmployeeId(),
                    coachName,
                    approvedTarget,
                    completedSessions,
                    remainingSessions,
                    deliveryPercentage,
                    latestAssessment,
                    trajectory,
                    attentionRequired,
                    attentionReason,
                    lastSessionDate,
                    nextScheduledDate,
                    totalLoggedSessions,
                    missedCount
            ));
        }

        // Sort: Attention required first, then lowest starting rating
        items.sort(Comparator.comparing(PmsTalentProgressItemDto::attentionRequired).reversed()
                .thenComparing(PmsTalentProgressItemDto::startingRating));

        return items;
    }

    public PmsTalentDossierDto getTalentDossier(Long assignmentId) {
        CoachingAssignment a = assignmentRepository.findById(assignmentId)
                .orElseThrow(() -> new ResourceNotFoundException("Coaching assignment not found with id: " + assignmentId));

        Employee coachee = employeeRepository.findById(a.getCoacheeEmployeeId())
                .orElseThrow(() -> new ResourceNotFoundException("Coachee employee not found"));
        Employee coach = a.getCoachEmployeeId() != null
                ? employeeRepository.findById(a.getCoachEmployeeId()).orElse(null)
                : null;

        String directorate = (coachee.getParentDepartmentName() != null && !coachee.getParentDepartmentName().isBlank())
                ? coachee.getParentDepartmentName()
                : "Head Office";

        // Performance appraisal & target weakness details
        PmsPerformanceRecord perf = resolvePerformanceRecord(a);
        BigDecimal rating = (perf != null && perf.getOverallFinalRating() != null)
                ? perf.getOverallFinalRating()
                : BigDecimal.valueOf(2.50);
        String ratingBand = rating.compareTo(BigDecimal.valueOf(2.0)) < 0 ? "CRITICAL" : "MODERATE";

        String targetWeaknessKpi = "General Core Banking Competency";
        String weaknessRootCause = "Needs practical reinforcement in branch operational workflows.";
        String targetScore = "3.00";
        String actualScore = rating.toPlainString();

        if (perf != null) {
            List<PmsGoalLine> goalLines = goalLineRepository.findAllByPerformanceRecordIdOrderBySourceRowNumberAsc(perf.getId());
            if (!goalLines.isEmpty()) {
                // Find lowest score goal line
                PmsGoalLine lowest = goalLines.stream()
                        .filter(g -> g.getGoalScore() != null)
                        .min(Comparator.comparing(PmsGoalLine::getGoalScore))
                        .orElse(goalLines.get(0));
                targetWeaknessKpi = lowest.getGoalName();
                if (lowest.getTargetValue() != null) targetScore = lowest.getTargetValue();
                if (lowest.getActualValue() != null) actualScore = lowest.getActualValue();
                weaknessRootCause = "Sub-target performance score: " + (lowest.getGoalScore() != null ? lowest.getGoalScore() : actualScore);
            }
        }

        // Session Target & Extension details
        CoachingSessionTarget target = sessionTargetRepository.findByAssignmentId(a.getId()).orElse(null);
        int policyBaseline = target != null ? target.getPolicyBaseline() : (rating.compareTo(BigDecimal.valueOf(2.0)) < 0 ? 10 : 6);
        int approvedTarget = target != null ? target.getApprovedTarget() : policyBaseline;
        String targetStatus = target != null ? target.getStatus().name() : "APPROVED";

        boolean isExtensionApproved = false;
        int extensionSessionsAdded = 0;
        if (target != null) {
            List<CoachingTargetAdjustment> adjustments = targetAdjustmentRepository.findAllBySessionTargetIdOrderByCreatedAtDesc(target.getId());
            for (CoachingTargetAdjustment adj : adjustments) {
                if (adj.getAdjustmentType() == AdjustmentType.EXTENSION_REQUEST && adj.getPmsDecision() == AdjustmentDecision.APPROVED) {
                    isExtensionApproved = true;
                    extensionSessionsAdded += Math.max(0, adj.getProposedTarget() - adj.getPreviousTarget());
                }
            }
        }

        // Load sessions and session logs (supports multi-coachee joint sessions via participant link)
        List<CoachingSession> sessions = sessionRepository.findAllSessionsForAssignment(a.getId());
        // Reverse to chronological order (earliest first)
        Collections.reverse(sessions);

        List<SessionProgressLogDto> sessionLogs = new ArrayList<>();
        int completedSessions = 0;
        CoachAssessment latestAssessment = null;
        Instant lastSessionDate = null;
        Instant nextScheduledDate = null;
        Instant now = Instant.now();

        int seq = 1;
        for (CoachingSession s : sessions) {
            Optional<SessionParticipant> coacheePartOpt = participantRepository.findBySessionIdAndEmployeeId(
                    s.getId(), coachee.getId());

            CoachAssessment assessment = null;
            AttendanceStatus attendanceStatus = AttendanceStatus.PENDING;
            String coacheeProgressNotes = null;
            Instant coacheeSubmittedAt = null;
            Short feedbackRating = null;
            String feedbackComment = null;
            Instant feedbackSubmittedAt = null;

            if (coacheePartOpt.isPresent()) {
                SessionParticipant cp = coacheePartOpt.get();
                assessment = cp.getCoachAssessment();
                attendanceStatus = cp.getAttendanceStatus();
                coacheeProgressNotes = cp.getCoacheeProgressNotes();
                coacheeSubmittedAt = cp.getCoacheeProgressSubmittedAt();
                feedbackRating = cp.getFeedbackRating();
                feedbackComment = cp.getFeedbackComment();
                feedbackSubmittedAt = cp.getFeedbackSubmittedAt();
            }

            if (s.getStatus() == SessionStatus.COMPLETED) {
                completedSessions++;
                lastSessionDate = s.getConductedAt();
                if (assessment != null) {
                    latestAssessment = assessment;
                }
            } else if (s.getStatus() == SessionStatus.CONFIRMED || s.getStatus() == SessionStatus.PROPOSED) {
                if (s.getScheduledStartTime().isAfter(now)) {
                    if (nextScheduledDate == null || s.getScheduledStartTime().isBefore(nextScheduledDate)) {
                        nextScheduledDate = s.getScheduledStartTime();
                    }
                }
            }

            sessionLogs.add(new SessionProgressLogDto(
                    s.getId(),
                    s.getSequenceNumber() != null ? s.getSequenceNumber() : seq++,
                    s.getTitle(),
                    s.getScheduledStartTime(),
                    s.getConductedAt(),
                    s.getDurationMinutes(),
                    s.getMeetingMode(),
                    s.getStatus(),
                    a.getCoachEmployeeId(),
                    coach != null ? coach.getFullName() : "Assigned Coach",
                    assessment,
                    s.getSessionNotesMinutes(),
                    s.getActionItems(),
                    coachee.getId(),
                    coachee.getFullName(),
                    attendanceStatus,
                    coacheeProgressNotes,
                    coacheeSubmittedAt,
                    feedbackRating,
                    feedbackComment,
                    feedbackSubmittedAt
            ));
        }

        int remainingSessions = Math.max(0, approvedTarget - completedSessions);
        double deliveryPercentage = approvedTarget > 0
                ? BigDecimal.valueOf(completedSessions * 100.0 / approvedTarget)
                .setScale(1, RoundingMode.HALF_UP).doubleValue()
                : 0.0;

        String trajectory = determineTrajectory(latestAssessment, completedSessions);

        FiscalQuarter quarter = fiscalQuarterRepository.findById(a.getCoachingFiscalQuarterId()).orElse(null);
        int missedCount = a.getMissedSessionsCount();
        boolean attentionRequired = isAttentionRequired(
                missedCount, lastSessionDate, nextScheduledDate, remainingSessions, quarter);
        String attentionReason = buildAttentionReason(
                missedCount, lastSessionDate, remainingSessions, quarter);

        String fiscalQuarterName = quarter != null
                ? "FY " + quarter.getFiscalYear() + " - Q" + quarter.getQuarter()
                : "Active Quarter";

        return new PmsTalentDossierDto(
                a.getId(),
                coachee.getId(),
                coachee.getEmployeeNumber(),
                coachee.getFullName(),
                coachee.getDepartmentName() != null ? coachee.getDepartmentName() : "Branch Operations",
                directorate,
                coachee.getJob() != null ? coachee.getJob() : "Banking Officer",
                coachee.getEmail(),
                fiscalQuarterName,
                rating,
                ratingBand,
                targetWeaknessKpi,
                weaknessRootCause,
                targetScore,
                actualScore,
                a.getCoachEmployeeId(),
                coach != null ? coach.getEmployeeNumber() : "N/A",
                coach != null ? coach.getFullName() : "Unassigned Coach",
                coach != null ? coach.getEmail() : null,
                policyBaseline,
                approvedTarget,
                completedSessions,
                remainingSessions,
                deliveryPercentage,
                targetStatus,
                isExtensionApproved,
                extensionSessionsAdded,
                latestAssessment,
                trajectory,
                attentionRequired,
                attentionReason,
                sessionLogs
        );
    }

    public String exportReportCsv(Long quarterId, String directorateFilter, String statusFilter, Boolean attentionOnly) {
        List<PmsTalentProgressItemDto> items = getTalentsProgress(quarterId, directorateFilter, statusFilter, attentionOnly, null);

        StringBuilder sb = new StringBuilder();
        // CSV Header
        sb.append("Employee Name,Staff ID,Department,Directorate,Starting Rating,Rating Band,Primary Weakness Gap,Coach Name,Approved Target,Completed Sessions,Remaining Sessions,Delivery Rate %,Competency Trajectory,Needs Attention,Attention Reason,Last Session Date,Next Scheduled Date\n");

        for (PmsTalentProgressItemDto item : items) {
            sb.append(escapeCsv(item.coacheeName())).append(",");
            sb.append(escapeCsv(item.coacheeStaffId())).append(",");
            sb.append(escapeCsv(item.department())).append(",");
            sb.append(escapeCsv(item.directorate())).append(",");
            sb.append(item.startingRating()).append(",");
            sb.append(escapeCsv(item.ratingBand())).append(",");
            sb.append(escapeCsv(item.targetWeaknessKpi())).append(",");
            sb.append(escapeCsv(item.coachName())).append(",");
            sb.append(item.approvedTarget()).append(",");
            sb.append(item.completedSessions()).append(",");
            sb.append(item.remainingSessions()).append(",");
            sb.append(item.deliveryPercentage()).append("%,");
            sb.append(escapeCsv(item.progressTrajectory())).append(",");
            sb.append(item.attentionRequired() ? "YES" : "NO").append(",");
            sb.append(escapeCsv(item.attentionReason() != null ? item.attentionReason() : "")).append(",");
            sb.append(item.lastSessionDate() != null ? item.lastSessionDate().toString() : "").append(",");
            sb.append(item.nextScheduledDate() != null ? item.nextScheduledDate().toString() : "").append("\n");
        }

        return sb.toString();
    }

    // ---- Private Helpers ----

    private FiscalQuarter resolveQuarter(Long quarterId) {
        if (quarterId != null) {
            return fiscalQuarterRepository.findById(quarterId).orElse(null);
        }
        return fiscalQuarterRepository.findByActiveTrue().orElse(null);
    }

    private List<CoachingAssignment> loadAssignmentsForQuarter(FiscalQuarter quarter) {
        if (quarter != null) {
            return assignmentRepository.findAll().stream()
                    .filter(a -> a.getPathway() == AssignmentPathway.MANDATORY_PMS)
                    .filter(a -> quarter.getId().equals(a.getCoachingFiscalQuarterId()))
                    .collect(Collectors.toList());
        }
        return assignmentRepository.findAll().stream()
                .filter(a -> a.getPathway() == AssignmentPathway.MANDATORY_PMS)
                .collect(Collectors.toList());
    }

    private PmsPerformanceRecord resolvePerformanceRecord(CoachingAssignment a) {
        if (a.getPerformanceRecordId() != null) {
            return performanceRecordRepository.findById(a.getPerformanceRecordId()).orElse(null);
        }
        return performanceRecordRepository.findFirstByEmployeeIdOrderByCreatedAtDesc(a.getCoacheeEmployeeId())
                .orElse(null);
    }

    private String resolveTargetWeakness(PmsPerformanceRecord perf) {
        if (perf == null) return "General Operational Core Banking Process";
        List<PmsGoalLine> lines = goalLineRepository.findAllByPerformanceRecordIdOrderBySourceRowNumberAsc(perf.getId());
        if (lines.isEmpty()) return "General Operational Core Banking Process";

        PmsGoalLine minLine = lines.stream()
                .filter(l -> l.getGoalScore() != null)
                .min(Comparator.comparing(PmsGoalLine::getGoalScore))
                .orElse(lines.get(0));

        return minLine.getGoalName();
    }

    private String determineTrajectory(CoachAssessment assessment, int completedSessions) {
        if (completedSessions == 0 || assessment == null) {
            return "NOT_STARTED";
        }
        return switch (assessment) {
            case MASTERED -> "MASTERED";
            case ON_TRACK -> "ON_TRACK";
            case PROGRESSING -> "IMPROVING";
            case NEEDS_IMPROVEMENT -> "NEEDS_IMPROVEMENT";
        };
    }

    private boolean isAttentionRequired(
            int missedSessionsCount,
            Instant lastCompletedDate,
            Instant nextScheduledDate,
            int remainingSessions,
            FiscalQuarter quarter) {

        // Rule 1: Two or more missed meetings
        if (missedSessionsCount >= 2) return true;

        Instant now = Instant.now();

        // Rule 2: Lapsed rhythm (>14 days without completed session AND no upcoming session scheduled within 7 days)
        if (remainingSessions > 0) {
            if (lastCompletedDate != null) {
                long daysSinceLast = ChronoUnit.DAYS.between(lastCompletedDate, now);
                if (daysSinceLast > 14) {
                    if (nextScheduledDate == null || ChronoUnit.DAYS.between(now, nextScheduledDate) > 7) {
                        return true;
                    }
                }
            } else {
                // No session completed yet
                if (nextScheduledDate == null) return true;
            }
        }

        // Rule 3: Quarter deadline proximity (< 21 days remaining with > 50% target incomplete)
        if (quarter != null && quarter.getEndDate() != null) {
            LocalDate today = LocalDate.now();
            long daysToQuarterEnd = ChronoUnit.DAYS.between(today, quarter.getEndDate());
            if (daysToQuarterEnd > 0 && daysToQuarterEnd <= 21 && remainingSessions > 0) {
                return true;
            }
        }

        return false;
    }

    private String buildAttentionReason(
            int missedSessionsCount,
            Instant lastCompletedDate,
            int remainingSessions,
            FiscalQuarter quarter) {

        List<String> reasons = new ArrayList<>();
        if (missedSessionsCount >= 2) {
            reasons.add(missedSessionsCount + " missed coaching sessions");
        }
        if (remainingSessions > 0 && lastCompletedDate != null) {
            long daysSinceLast = ChronoUnit.DAYS.between(lastCompletedDate, Instant.now());
            if (daysSinceLast > 14) {
                reasons.add("Lapsed rhythm (" + daysSinceLast + " days inactive)");
            }
        } else if (remainingSessions > 0 && lastCompletedDate == null) {
            reasons.add("No session conducted yet");
        }
        if (quarter != null && quarter.getEndDate() != null) {
            LocalDate today = LocalDate.now();
            long daysToQuarterEnd = ChronoUnit.DAYS.between(today, quarter.getEndDate());
            if (daysToQuarterEnd > 0 && daysToQuarterEnd <= 21 && remainingSessions > 0) {
                reasons.add("Quarter-end deadline in " + daysToQuarterEnd + " days (" + remainingSessions + " remaining)");
            }
        }
        return String.join(" · ", reasons);
    }

    /**
     * Sanitizes values to prevent CSV formula injection when opened in Excel/Sheets.
     */
    private String escapeCsv(String value) {
        if (value == null) return "";
        String val = value.trim();
        // Prevent formula injection: prepend single quote if starting with =, +, -, @, \t, \r
        if (val.startsWith("=") || val.startsWith("+") || val.startsWith("-") || val.startsWith("@") || val.startsWith("\t") || val.startsWith("\r")) {
            val = "'" + val;
        }
        if (val.contains(",") || val.contains("\"") || val.contains("\n") || val.contains("\r")) {
            val = "\"" + val.replace("\"", "\"\"") + "\"";
        }
        return val;
    }

    public DistrictBranchAnalyticsDto getHierarchicalAnalytics(Long quarterId) {
        FiscalQuarter quarter = resolveQuarter(quarterId);
        List<CoachingAssignment> assignments = loadAssignmentsForQuarter(quarter);
        List<Employee> allEmployees = employeeRepository.findAll();

        int totalEmployeesMonitored = allEmployees.size();
        int totalCoachingAssignments = assignments.size();
        int bankCriticalCount = 0;
        int bankModerateCount = 0;
        int bankTargetSessions = 0;
        int bankCompletedSessions = 0;
        int bankAttentionRequiredCount = 0;

        // Map coacheeEmployeeId -> Assignment
        Map<Long, CoachingAssignment> assignmentByCoachee = new HashMap<>();
        for (CoachingAssignment a : assignments) {
            assignmentByCoachee.put(a.getCoacheeEmployeeId(), a);
        }

        // Map District -> (Branch -> List<Employee>)
        Map<String, Map<String, List<Employee>>> orgTree = new TreeMap<>(String.CASE_INSENSITIVE_ORDER);
        for (Employee e : allEmployees) {
            String district = (e.getParentDepartmentName() != null && !e.getParentDepartmentName().isBlank())
                    ? e.getParentDepartmentName().trim()
                    : "Head Office";
            String branch = (e.getDepartmentName() != null && !e.getDepartmentName().isBlank())
                    ? e.getDepartmentName().trim()
                    : "General Operations";

            orgTree.computeIfAbsent(district, d -> new TreeMap<>(String.CASE_INSENSITIVE_ORDER))
                    .computeIfAbsent(branch, b -> new ArrayList<>())
                    .add(e);
        }

        List<DistrictAnalyticsDto> districtDtos = new ArrayList<>();

        for (Map.Entry<String, Map<String, List<Employee>>> distEntry : orgTree.entrySet()) {
            String districtName = distEntry.getKey();
            Map<String, List<Employee>> branchMap = distEntry.getValue();

            int distTotalStaff = 0;
            int distCoacheesCount = 0;
            int distCriticalCount = 0;
            int distModerateCount = 0;
            int distTargetSessions = 0;
            int distCompletedSessions = 0;
            int distOverdueCount = 0;
            double distScoreSum = 0;
            int distScoreCount = 0;
            Map<String, Integer> distGapsCount = new HashMap<>();

            List<BranchAnalyticsDto> branchDtos = new ArrayList<>();

            for (Map.Entry<String, List<Employee>> branchEntry : branchMap.entrySet()) {
                String branchName = branchEntry.getKey();
                List<Employee> staffList = branchEntry.getValue();

                int branchTotalStaff = staffList.size();
                int branchCoacheesCount = 0;
                int branchCriticalCount = 0;
                int branchModerateCount = 0;
                int branchTargetSessions = 0;
                int branchCompletedSessions = 0;
                int branchOverdueCount = 0;
                double branchScoreSum = 0;
                int branchScoreCount = 0;
                Set<Long> branchCoaches = new HashSet<>();
                Map<String, Integer> branchGapsCount = new HashMap<>();

                for (Employee staff : staffList) {
                    CoachingAssignment a = assignmentByCoachee.get(staff.getId());
                    if (a != null) {
                        branchCoacheesCount++;
                        if (a.getCoachEmployeeId() != null) {
                            branchCoaches.add(a.getCoachEmployeeId());
                        }

                        PmsPerformanceRecord perf = resolvePerformanceRecord(a);
                        BigDecimal rating = (perf != null && perf.getOverallFinalRating() != null)
                                ? perf.getOverallFinalRating()
                                : BigDecimal.valueOf(2.50);

                        branchScoreSum += rating.doubleValue();
                        branchScoreCount++;

                        if (rating.compareTo(BigDecimal.valueOf(2.0)) < 0) {
                            branchCriticalCount++;
                        } else {
                            branchModerateCount++;
                        }

                        CoachingSessionTarget target = sessionTargetRepository.findByAssignmentId(a.getId()).orElse(null);
                        int approvedTarget = (target != null && target.getApprovedTarget() > 0)
                                ? target.getApprovedTarget()
                                : (rating.compareTo(BigDecimal.valueOf(2.0)) < 0 ? 10 : 6);
                        branchTargetSessions += approvedTarget;

                        List<CoachingSession> sessions = sessionRepository.findAllSessionsForAssignment(a.getId());
                        int completed = 0;
                        Instant lastSessionDate = null;
                        Instant nextScheduledDate = null;
                        Instant now = Instant.now();
                        for (CoachingSession s : sessions) {
                            if (s.getStatus() == SessionStatus.COMPLETED) {
                                completed++;
                                if (s.getConductedAt() != null && (lastSessionDate == null || s.getConductedAt().isAfter(lastSessionDate))) {
                                    lastSessionDate = s.getConductedAt();
                                }
                            } else if ((s.getStatus() == SessionStatus.CONFIRMED || s.getStatus() == SessionStatus.PROPOSED) && s.getScheduledStartTime().isAfter(now)) {
                                if (nextScheduledDate == null || s.getScheduledStartTime().isBefore(nextScheduledDate)) {
                                    nextScheduledDate = s.getScheduledStartTime();
                                }
                            }
                        }
                        branchCompletedSessions += completed;

                        int remainingSessions = Math.max(0, approvedTarget - completed);
                        boolean attentionRequired = isAttentionRequired(a.getMissedSessionsCount(), lastSessionDate, nextScheduledDate, remainingSessions, quarter);
                        if (attentionRequired) {
                            branchOverdueCount++;
                        }

                        String weakness = resolveTargetWeakness(perf);
                        branchGapsCount.put(weakness, branchGapsCount.getOrDefault(weakness, 0) + 1);
                        distGapsCount.put(weakness, distGapsCount.getOrDefault(weakness, 0) + 1);
                    }
                }

                double branchCompletionRate = branchTargetSessions > 0
                        ? BigDecimal.valueOf(branchCompletedSessions * 100.0 / branchTargetSessions).setScale(1, RoundingMode.HALF_UP).doubleValue()
                        : 0.0;
                double branchAvgScore = branchScoreCount > 0
                        ? BigDecimal.valueOf(branchScoreSum / branchScoreCount).setScale(2, RoundingMode.HALF_UP).doubleValue()
                        : 0.0;
                String branchTopGap = branchGapsCount.entrySet().stream()
                        .max(Map.Entry.comparingByValue())
                        .map(Map.Entry::getKey)
                        .orElse("Branch Operations");

                branchDtos.add(new BranchAnalyticsDto(
                        branchName,
                        branchTotalStaff,
                        branchCoacheesCount,
                        branchCriticalCount,
                        branchModerateCount,
                        branchTargetSessions,
                        branchCompletedSessions,
                        branchCompletionRate,
                        branchOverdueCount,
                        branchAvgScore,
                        branchTopGap,
                        branchCoaches.size()
                ));

                distTotalStaff += branchTotalStaff;
                distCoacheesCount += branchCoacheesCount;
                distCriticalCount += branchCriticalCount;
                distModerateCount += branchModerateCount;
                distTargetSessions += branchTargetSessions;
                distCompletedSessions += branchCompletedSessions;
                distOverdueCount += branchOverdueCount;
                distScoreSum += branchScoreSum;
                distScoreCount += branchScoreCount;
            }

            double distCompletionRate = distTargetSessions > 0
                    ? BigDecimal.valueOf(distCompletedSessions * 100.0 / distTargetSessions).setScale(1, RoundingMode.HALF_UP).doubleValue()
                    : 0.0;
            double distAvgScore = distScoreCount > 0
                    ? BigDecimal.valueOf(distScoreSum / distScoreCount).setScale(2, RoundingMode.HALF_UP).doubleValue()
                    : 0.0;
            String distTopGap = distGapsCount.entrySet().stream()
                    .max(Map.Entry.comparingByValue())
                    .map(Map.Entry::getKey)
                    .orElse("Branch Operations");

            // Sort branches by coachees count descending
            branchDtos.sort(Comparator.comparing(BranchAnalyticsDto::coacheesCount).reversed()
                    .thenComparing(BranchAnalyticsDto::branchName));

            districtDtos.add(new DistrictAnalyticsDto(
                    districtName,
                    distTotalStaff,
                    distCoacheesCount,
                    distCriticalCount,
                    distModerateCount,
                    distTargetSessions,
                    distCompletedSessions,
                    distCompletionRate,
                    distOverdueCount,
                    distAvgScore,
                    distTopGap,
                    branchDtos
            ));

            bankCriticalCount += distCriticalCount;
            bankModerateCount += distModerateCount;
            bankTargetSessions += distTargetSessions;
            bankCompletedSessions += distCompletedSessions;
            bankAttentionRequiredCount += distOverdueCount;
        }

        // Sort districts by coachees count descending
        districtDtos.sort(Comparator.comparing(DistrictAnalyticsDto::coacheesCount).reversed()
                .thenComparing(DistrictAnalyticsDto::districtName));

        double overallCompletionRate = bankTargetSessions > 0
                ? BigDecimal.valueOf(bankCompletedSessions * 100.0 / bankTargetSessions).setScale(1, RoundingMode.HALF_UP).doubleValue()
                : 0.0;

        String quarterName = quarter != null
                ? "FY " + quarter.getFiscalYear() + " · Q" + quarter.getQuarter()
                : "Active Quarter";

        return new DistrictBranchAnalyticsDto(
                quarter != null ? quarter.getId() : null,
                quarterName,
                totalEmployeesMonitored,
                totalCoachingAssignments,
                bankCriticalCount,
                bankModerateCount,
                bankTargetSessions,
                bankCompletedSessions,
                overallCompletionRate,
                bankAttentionRequiredCount,
                districtDtos
        );
    }

    public ReportingFilterOptionsDto getFilterOptions(Long quarterId) {
        List<Employee> all = employeeRepository.findAll();
        Map<String, Set<String>> branchesByDist = new TreeMap<>(String.CASE_INSENSITIVE_ORDER);

        for (Employee e : all) {
            String district = (e.getParentDepartmentName() != null && !e.getParentDepartmentName().isBlank())
                    ? e.getParentDepartmentName().trim()
                    : "Head Office";
            String branch = (e.getDepartmentName() != null && !e.getDepartmentName().isBlank())
                    ? e.getDepartmentName().trim()
                    : "General Operations";
            branchesByDist.computeIfAbsent(district, d -> new TreeSet<>(String.CASE_INSENSITIVE_ORDER))
                    .add(branch);
        }

        List<String> districts = new ArrayList<>(branchesByDist.keySet());
        Map<String, List<String>> branchMap = new LinkedHashMap<>();
        for (Map.Entry<String, Set<String>> entry : branchesByDist.entrySet()) {
            branchMap.put(entry.getKey(), new ArrayList<>(entry.getValue()));
        }

        return new ReportingFilterOptionsDto(
                districts,
                branchMap,
                List.of("ALL", "CRITICAL", "MODERATE", "SATISFACTORY"),
                List.of("ALL", "ACTIVE", "COMPLETED", "ATTENTION_REQUIRED"),
                List.of("ALL", "NOT_STARTED", "IN_PROGRESS", "TARGET_MET")
        );
    }

    public SessionInspectionEvidenceDto getSessionInspectionEvidence(Long sessionId) {
        CoachingSession session = sessionRepository.findById(sessionId)
                .orElseThrow(() -> new ResourceNotFoundException("Coaching session not found: " + sessionId));

        Employee coach = session.getCoachEmployeeId() != null
                ? employeeRepository.findById(session.getCoachEmployeeId()).orElse(null)
                : null;
        String coachName = coach != null ? coach.getFullName() : "Coach";
        String coachRole = coach != null ? (coach.getJob() != null ? coach.getJob() : "Coach") : "Coach";

        List<SessionParticipant> participants = participantRepository.findAllBySessionIdOrderByRoleAsc(sessionId);
        SessionParticipant coacheePart = participants.stream()
                .filter(p -> p.getRole() == ParticipantRole.COACHEE)
                .findFirst()
                .orElse(null);

        Employee coachee = null;
        if (coacheePart != null) {
            coachee = employeeRepository.findById(coacheePart.getEmployeeId()).orElse(null);
        }

        Long coacheeEmployeeId = coachee != null ? coachee.getId() : null;
        String coacheeName = coachee != null ? coachee.getFullName() : "Coachee";
        String coacheeStaffId = coachee != null ? coachee.getEmployeeNumber() : "";
        String district = coachee != null && coachee.getParentDepartmentName() != null
                ? coachee.getParentDepartmentName()
                : "Head Office";
        String branch = coachee != null && coachee.getDepartmentName() != null
                ? coachee.getDepartmentName()
                : "General";

        String attendanceStatus = coacheePart != null && coacheePart.getAttendanceStatus() != null
                ? coacheePart.getAttendanceStatus().name()
                : "PENDING";
        String coachAssessment = coacheePart != null && coacheePart.getCoachAssessment() != null
                ? coacheePart.getCoachAssessment().name()
                : "PENDING";
        String coacheeNotes = coacheePart != null ? coacheePart.getCoacheeProgressNotes() : null;
        Short feedbackRating = coacheePart != null ? coacheePart.getFeedbackRating() : null;
        String feedbackComment = coacheePart != null ? coacheePart.getFeedbackComment() : null;

        List<CoachingSessionTurn> turns = turnRepository.findAllBySessionIdOrderByTurnIndexAsc(sessionId);
        List<SessionTurnEvidenceDto> turnDtos = turns.stream()
                .map(t -> new SessionTurnEvidenceDto(
                        t.getId(),
                        t.getTurnIndex(),
                        t.getSpeakerName(),
                        t.getSpeakerRole(),
                        t.getStartTimeOffsetSec(),
                        t.getDurationSec(),
                        t.getTranscriptEnglish(),
                        t.getTranscriptAmharic(),
                        t.getReconciledText()
                ))
                .toList();

        List<String> keyTopics = List.of();

        return new SessionInspectionEvidenceDto(
                session.getId(),
                session.getAssignmentId(),
                session.getTitle() != null ? session.getTitle() : "Coaching Session",
                session.getMeetingMode() != null ? session.getMeetingMode().name() : "VIRTUAL_VIDEO",
                session.getStatus() != null ? session.getStatus().name() : "SCHEDULED",
                session.getConductedAt(),
                session.getDurationMinutes(),
                session.getCoachEmployeeId(),
                coachName,
                coachRole,
                coacheeEmployeeId,
                coacheeName,
                coacheeStaffId,
                district,
                branch,
                attendanceStatus,
                coachAssessment,
                coacheeNotes,
                feedbackRating,
                feedbackComment,
                session.getMinutesSynthesisStatus() != null ? session.getMinutesSynthesisStatus() : "IDLE",
                session.getSessionNotesMinutes(),
                session.getActionItems(),
                keyTopics,
                turnDtos
        );
    }

    public List<TopCoachRatingDto> getTopRatedCoaches(Long quarterId) {
        FiscalQuarter quarter = resolveQuarter(quarterId);
        List<CoachingAssignment> assignments = loadAssignmentsForQuarter(quarter);

        Map<Long, List<CoachingAssignment>> coachAssignments = assignments.stream()
                .filter(a -> a.getCoachEmployeeId() != null)
                .collect(Collectors.groupingBy(CoachingAssignment::getCoachEmployeeId));

        List<TopCoachRatingDto> result = new ArrayList<>();

        for (Map.Entry<Long, List<CoachingAssignment>> entry : coachAssignments.entrySet()) {
            Long coachId = entry.getKey();
            List<CoachingAssignment> coachAsgList = entry.getValue();
            Employee coach = employeeRepository.findById(coachId).orElse(null);
            if (coach == null) continue;

            List<CoachingSession> completedSessions = new ArrayList<>();
            List<Short> ratings = new ArrayList<>();

            for (CoachingAssignment asg : coachAsgList) {
                List<CoachingSession> sessions = sessionRepository.findAllByAssignmentId(asg.getId());
                for (CoachingSession s : sessions) {
                    if (s.getStatus() == SessionStatus.COMPLETED) {
                        completedSessions.add(s);
                        List<SessionParticipant> participants = participantRepository.findAllBySessionIdOrderByRoleAsc(s.getId());
                        for (SessionParticipant p : participants) {
                            if (p.getRole() == ParticipantRole.COACHEE && p.getFeedbackRating() != null) {
                                ratings.add(p.getFeedbackRating());
                            }
                        }
                    }
                }
            }

            Double avgRating = null;
            if (!ratings.isEmpty()) {
                double sum = 0;
                for (Short r : ratings) sum += r;
                avgRating = Math.round((sum / ratings.size()) * 100.0) / 100.0;
            }

            String badge;
            if (avgRating != null && avgRating >= 4.8 && ratings.size() >= 3) {
                badge = "MASTER COACH";
            } else if (avgRating != null && avgRating >= 4.5) {
                badge = "EXCELLENCE";
            } else if (avgRating != null && avgRating >= 4.0) {
                badge = "COMMENDED";
            } else if (avgRating != null && avgRating > 0) {
                badge = "DEVELOPING";
            } else {
                badge = "PENDING EVALUATION";
            }

            result.add(new TopCoachRatingDto(
                    coachId,
                    coach.getFullName(),
                    coach.getEmployeeNumber(),
                    coach.getDepartmentName() != null ? coach.getDepartmentName() : "General",
                    coach.getParentDepartmentName() != null ? coach.getParentDepartmentName() : "Head Office",
                    avgRating,
                    ratings.size(),
                    completedSessions.size(),
                    coachAsgList.size(),
                    badge
            ));
        }

        result.sort((a, b) -> {
            if (a.averageRating() == null && b.averageRating() == null) return 0;
            if (a.averageRating() == null) return 1;
            if (b.averageRating() == null) return -1;
            int cmp = Double.compare(b.averageRating(), a.averageRating());
            if (cmp != 0) return cmp;
            return Integer.compare(b.totalRatings(), a.totalRatings());
        });

        return result;
    }

    public List<MidQuarterInactivityDto> getMidQuarterInactivity(Long quarterId) {
        FiscalQuarter quarter = resolveQuarter(quarterId);
        List<CoachingAssignment> assignments = loadAssignmentsForQuarter(quarter);

        LocalDate today = LocalDate.now();
        long elapsedDays = ChronoUnit.DAYS.between(quarter.getStartDate(), today);
        int elapsedWeeks = Math.max(1, (int) (elapsedDays / 7));

        List<MidQuarterInactivityDto> items = new ArrayList<>();

        for (CoachingAssignment a : assignments) {
            if (a.getStatus() != AssignmentStatus.ACTIVE && a.getStatus() != AssignmentStatus.PENDING_COACH_ASSIGNMENT) {
                continue;
            }

            Employee coach = a.getCoachEmployeeId() != null
                    ? employeeRepository.findById(a.getCoachEmployeeId()).orElse(null)
                    : null;
            Employee coachee = employeeRepository.findById(a.getCoacheeEmployeeId()).orElse(null);

            List<CoachingSession> sessions = sessionRepository.findAllByAssignmentId(a.getId());
            long completed = sessions.stream().filter(s -> s.getStatus() == SessionStatus.COMPLETED).count();

            String severity = "ON_TRACK";
            String recommendation = "Maintain bi-weekly coaching cadence.";

            if (completed == 0) {
                if (elapsedWeeks >= 5) {
                    severity = "CRITICAL_STALL";
                    recommendation = "Immediate executive escalation: kickoff session pending past mid-quarter gate (Week " + elapsedWeeks + "). Mandate immediate scheduling or trigger coach reassignment.";
                } else {
                    severity = "PENDING_KICKOFF";
                    recommendation = "Kickoff session due within the first 3 weeks.";
                }
            } else if (completed < 3 && elapsedWeeks >= 5) {
                severity = "BEHIND_PACING";
                recommendation = "Behind pacing target: " + completed + " of 10 completed by Week " + elapsedWeeks + ". Accelerate session frequency.";
            }

            if (!"ON_TRACK".equals(severity)) {
                items.add(new MidQuarterInactivityDto(
                        a.getId(),
                        coach != null ? coach.getId() : null,
                        coach != null ? coach.getFullName() : "Unassigned Coach",
                        coach != null ? coach.getEmployeeNumber() : "N/A",
                        coach != null ? coach.getEmail() : null,
                        coachee != null ? coachee.getFullName() : "Coachee",
                        coachee != null ? coachee.getEmployeeNumber() : "N/A",
                        coachee != null ? coachee.getEmail() : null,
                        coachee != null ? coachee.getDepartmentName() : "General",
                        coachee != null ? coachee.getParentDepartmentName() : "Head Office",
                        elapsedWeeks,
                        (int) completed,
                        10,
                        severity,
                        a.getLastActivityAt(),
                        recommendation
                ));
            }
        }

        items.sort(Comparator.comparingInt(item -> {
            if ("CRITICAL_STALL".equals(item.severity())) return 0;
            if ("BEHIND_PACING".equals(item.severity())) return 1;
            return 2;
        }));

        return items;
    }

    @Transactional
    public BatchNotificationResultDto notifyStalledCoaches(Long quarterId) {
        List<MidQuarterInactivityDto> stalled = getMidQuarterInactivity(quarterId);
        int notifiedCount = 0;
        int emailsQueued = 0;

        for (MidQuarterInactivityDto item : stalled) {
            if (item.coachEmployeeId() != null) {
                Employee coach = employeeRepository.findById(item.coachEmployeeId()).orElse(null);
                if (coach != null && coach.getUserId() != null) {
                    try {
                        notificationService.notify(
                                coach.getUserId(),
                                NotificationModule.COACHING,
                                "COACHING_STALLED_ESCALATION",
                                "⚠️ Mandatory Coaching Stalled: Week " + item.elapsedWeeks() + " Mid-Quarter Check",
                                "You have completed " + item.completedSessions() + " of " + item.targetSessions() +
                                        " required sessions for coachee " + item.coacheeName() + " (" + item.coacheeStaffId() + "). " +
                                        item.recommendedAction(),
                                "/coaching/sessions"
                        );
                        notifiedCount++;
                        emailsQueued++;
                    } catch (Exception ex) {
                        log.warn("Could not dispatch mid-quarter notification to coach userId {}: {}", coach.getUserId(), ex.getMessage());
                    }
                }
            }
        }

        return new BatchNotificationResultDto(
                stalled.size(),
                notifiedCount,
                emailsQueued,
                "Successfully dispatched " + notifiedCount + " mid-quarter escalation notifications to stalled coaches."
        );
    }

    private static class MutableDirectorateSummary {
        final String directorate;
        long totalCoached = 0;
        long showingImprovement = 0;
        int approvedSessions = 0;
        int completedSessions = 0;
        long atRiskCount = 0;

        MutableDirectorateSummary(String directorate) {
            this.directorate = directorate;
        }
    }
}
