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
import com.boa.apid.coaching.session.repository.CoachingSessionRepository;
import com.boa.apid.coaching.session.repository.SessionParticipantRepository;
import com.boa.apid.common.exception.ResourceNotFoundException;
import com.boa.apid.core.config.entity.FiscalQuarter;
import com.boa.apid.core.config.repository.FiscalQuarterRepository;
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

    public PmsCoachingReportService(
            CoachingAssignmentRepository assignmentRepository,
            CoachingSessionRepository sessionRepository,
            SessionParticipantRepository participantRepository,
            CoachingSessionTargetRepository sessionTargetRepository,
            CoachingTargetAdjustmentRepository targetAdjustmentRepository,
            EmployeeRepository employeeRepository,
            PmsPerformanceRecordRepository performanceRecordRepository,
            PmsGoalLineRepository goalLineRepository,
            FiscalQuarterRepository fiscalQuarterRepository) {
        this.assignmentRepository = assignmentRepository;
        this.sessionRepository = sessionRepository;
        this.participantRepository = participantRepository;
        this.sessionTargetRepository = sessionTargetRepository;
        this.targetAdjustmentRepository = targetAdjustmentRepository;
        this.employeeRepository = employeeRepository;
        this.performanceRecordRepository = performanceRecordRepository;
        this.goalLineRepository = goalLineRepository;
        this.fiscalQuarterRepository = fiscalQuarterRepository;
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

            // Sessions
            List<CoachingSession> sessions = sessionRepository.findAllByAssignmentId(a.getId());
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
                if (!directorate.equalsIgnoreCase(directorateFilter.trim())) {
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

            String targetWeaknessKpi = resolveTargetWeakness(perf);

            // Targets
            CoachingSessionTarget target = sessionTargetRepository.findByAssignmentId(a.getId()).orElse(null);
            int approvedTarget = (target != null && target.getApprovedTarget() > 0)
                    ? target.getApprovedTarget()
                    : (rating.compareTo(BigDecimal.valueOf(2.0)) < 0 ? 10 : 6);

            // Sessions
            List<CoachingSession> sessions = sessionRepository.findAllByAssignmentId(a.getId());
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

        // Load sessions and session logs
        List<CoachingSession> sessions = sessionRepository.findAllByAssignmentIdOrderByScheduledStartTimeDesc(a.getId());
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
