package com.boa.apid.coaching.referral.service;

import com.boa.apid.common.exception.BusinessException;
import com.boa.apid.common.exception.ResourceNotFoundException;
import com.boa.apid.coaching.assignment.entity.AssignmentPathway;
import com.boa.apid.coaching.assignment.entity.AssignmentStatus;
import com.boa.apid.coaching.assignment.entity.CoachingAssignment;
import com.boa.apid.coaching.assignment.repository.CoachingAssignmentRepository;
import com.boa.apid.coaching.importpms.entity.PmsPerformanceRecord;
import com.boa.apid.coaching.importpms.repository.PmsPerformanceRecordRepository;
import com.boa.apid.coaching.referral.dto.PmsReferralCaseDto;
import com.boa.apid.coaching.referral.dto.ResolveReferralRequest;
import com.boa.apid.coaching.referral.entity.PmsReferralCase;
import com.boa.apid.coaching.referral.repository.PmsReferralCaseRepository;
import com.boa.apid.coaching.session.repository.SessionParticipantRepository;
import com.boa.apid.core.audit.service.AuditService;
import com.boa.apid.core.authorization.repository.UserRepository;
import com.boa.apid.core.notifications.entity.NotificationChannel;
import com.boa.apid.core.notifications.entity.NotificationModule;
import com.boa.apid.core.notifications.service.NotificationService;
import com.boa.apid.core.organization.entity.Employee;
import com.boa.apid.core.organization.repository.EmployeeRepository;
import com.boa.apid.core.security.ApidUserPrincipal;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.*;

@Service
public class PmsReferralService {

    private static final Logger log = LoggerFactory.getLogger(PmsReferralService.class);
    private static final BigDecimal THRESHOLD_SCORE = new BigDecimal("3.0");

    private final PmsReferralCaseRepository referralRepository;
    private final CoachingAssignmentRepository assignmentRepository;
    private final PmsPerformanceRecordRepository performanceRecordRepository;
    private final EmployeeRepository employeeRepository;
    private final UserRepository userRepository;
    private final SessionParticipantRepository participantRepository;
    private final NotificationService notificationService;
    private final AuditService auditService;
    private final ObjectMapper objectMapper;

    public PmsReferralService(
            PmsReferralCaseRepository referralRepository,
            CoachingAssignmentRepository assignmentRepository,
            PmsPerformanceRecordRepository performanceRecordRepository,
            EmployeeRepository employeeRepository,
            UserRepository userRepository,
            SessionParticipantRepository participantRepository,
            NotificationService notificationService,
            AuditService auditService,
            ObjectMapper objectMapper
    ) {
        this.referralRepository = referralRepository;
        this.assignmentRepository = assignmentRepository;
        this.performanceRecordRepository = performanceRecordRepository;
        this.employeeRepository = employeeRepository;
        this.userRepository = userRepository;
        this.participantRepository = participantRepository;
        this.notificationService = notificationService;
        this.auditService = auditService;
        this.objectMapper = objectMapper;
    }

    @Transactional(readOnly = true)
    public List<PmsReferralCaseDto> getAllReferrals(String status) {
        List<PmsReferralCase> list;
        if (status != null && !status.isBlank() && !status.equalsIgnoreCase("ALL")) {
            list = referralRepository.findAllByStatusOrderByEscalatedAtDesc(status.toUpperCase().trim());
        } else {
            list = referralRepository.findAllByOrderByEscalatedAtDesc();
        }
        return list.stream().map(this::toDto).toList();
    }

    @Transactional
    public int scanAndDetectReferrals() {
        log.info("Running automated PMS referral scan for persistent low-performers (< 3.0 for 2+ consecutive quarters)...");
        List<CoachingAssignment> mandatoryAssignments = assignmentRepository
                .findAllByPathwayAndStatus(AssignmentPathway.MANDATORY_PMS, AssignmentStatus.ACTIVE);

        int newReferralsCount = 0;
        List<Long> adminUserIds = userRepository.findActivePmsAdminUserIds();

        for (CoachingAssignment assignment : mandatoryAssignments) {
            Long coacheeId = assignment.getCoacheeEmployeeId();

            // Fetch records in chronological reverse order
            List<PmsPerformanceRecord> records = performanceRecordRepository
                    .findAllByEmployeeIdOrderByPerformanceFiscalQuarterIdDesc(coacheeId);

            int consecutiveLow = 0;
            List<Map<String, Object>> scoreList = new ArrayList<>();

            for (PmsPerformanceRecord rec : records) {
                if (rec.getOverallFinalRating() != null && rec.getOverallFinalRating().compareTo(THRESHOLD_SCORE) < 0) {
                    consecutiveLow++;
                    scoreList.add(Map.of(
                            "quarter", (rec.getPmsYear() != null ? rec.getPmsYear() : "") + " Q" + rec.getPmsQuarter(),
                            "score", rec.getOverallFinalRating().doubleValue()
                    ));
                } else {
                    break; // Streak broken
                }
            }

            // If employee has scored < 3.0 across 2 or more consecutive quarters
            if (consecutiveLow >= 2) {
                boolean alreadyPending = referralRepository.existsByCoacheeEmployeeIdAndStatus(coacheeId, "PENDING_ADMIN_ACTION");
                if (!alreadyPending) {
                    Employee coachee = employeeRepository.findById(coacheeId).orElse(null);
                    if (coachee == null) continue;

                    String jsonScores = "[]";
                    try {
                        jsonScores = objectMapper.writeValueAsString(scoreList);
                    } catch (Exception ignored) {}

                    PmsReferralCase referral = new PmsReferralCase();
                    referral.setCoacheeEmployeeId(coacheeId);
                    referral.setCurrentCoachEmployeeId(assignment.getCoachEmployeeId());
                    referral.setAssignmentId(assignment.getId());
                    referral.setConsecutiveLowQuartersCount(consecutiveLow);
                    referral.setLatestScoresJson(jsonScores);
                    referral.setStatus("PENDING_ADMIN_ACTION");
                    referral.setEscalatedAt(Instant.now());

                    PmsReferralCase saved = referralRepository.save(referral);
                    newReferralsCount++;

                    log.warn("Created PMS Persistent Low-Score Referral #{} for Coachee {} ({} consecutive quarters < 3.0)",
                            saved.getId(), coachee.getFullName(), consecutiveLow);

                    // Notify PMS Admins via in-app notification and email outbox
                    for (Long adminId : adminUserIds) {
                        notificationService.notify(
                                adminId,
                                NotificationModule.COACHING,
                                "PMS_PERSISTENT_LOW_SCORE_REFERRAL",
                                "⚠️ Low PMS Score Referral: " + coachee.getFullName(),
                                coachee.getFullName() + " (" + coachee.getEmployeeNumber() + ") scored < 3.0 across "
                                        + consecutiveLow + " consecutive quarters under mandatory coaching. Review for reassignment or HR action.",
                                "/coaching?view=pms-referrals"
                        );
                        notificationService.enqueueViaOutbox(
                                adminId,
                                NotificationModule.COACHING,
                                "PMS_PERSISTENT_LOW_SCORE_REFERRAL",
                                "⚠️ Mandatory Referral: " + coachee.getFullName() + " Consistent Score < 3.0",
                                coachee.getFullName() + " (" + coachee.getEmployeeNumber() + ") scored < 3.0 across consecutive quarters. Action required.",
                                "/coaching?view=pms-referrals",
                                NotificationChannel.EMAIL
                        );
                    }
                }
            }
        }

        log.info("PMS referral scan completed. Generated {} new referral cases.", newReferralsCount);
        return newReferralsCount;
    }

    @Transactional
    public PmsReferralCaseDto resolveReferral(Long referralId, ResolveReferralRequest request, ApidUserPrincipal actor) {
        PmsReferralCase referral = referralRepository.findById(referralId)
                .orElseThrow(() -> new ResourceNotFoundException("PMS referral case not found: " + referralId));

        if (!"PENDING_ADMIN_ACTION".equals(referral.getStatus())) {
            throw new BusinessException("ALREADY_RESOLVED", "This referral case has already been resolved.");
        }

        String type = request.resolutionType().toUpperCase().trim();
        referral.setResolutionType(type);
        referral.setResolutionNotes(request.notes().trim());
        referral.setPmsAdminUserId(actor.getUserId());
        referral.setResolvedAt(Instant.now());

        Employee coachee = employeeRepository.findById(referral.getCoacheeEmployeeId()).orElse(null);
        Employee oldCoach = referral.getCurrentCoachEmployeeId() != null
                ? employeeRepository.findById(referral.getCurrentCoachEmployeeId()).orElse(null)
                : null;

        if ("REASSIGN_COACH".equals(type)) {
            if (request.newCoachEmployeeId() == null) {
                throw new BusinessException("COACH_REQUIRED", "Please select a replacement coach for reassignment.");
            }
            if (request.newCoachEmployeeId().equals(referral.getCurrentCoachEmployeeId())) {
                throw new BusinessException("SAME_COACH", "Replacement coach cannot be the same as the current coach.");
            }

            Employee newCoach = employeeRepository.findById(request.newCoachEmployeeId())
                    .orElseThrow(() -> new ResourceNotFoundException("Replacement coach not found."));

            referral.setStatus("REASSIGNED");
            referral.setNewCoachEmployeeId(newCoach.getId());

            // Update Coaching Assignment
            if (referral.getAssignmentId() != null) {
                CoachingAssignment assignment = assignmentRepository.findById(referral.getAssignmentId()).orElse(null);
                if (assignment != null) {
                    assignment.setCoachEmployeeId(newCoach.getId());
                    assignment.setUpdatedAt(Instant.now());
                    assignmentRepository.save(assignment);
                }
            }

            // 1. Notify Coachee
            if (coachee != null && coachee.getUserId() != null) {
                notificationService.notify(
                        coachee.getUserId(),
                        NotificationModule.COACHING,
                        "COACHING_REASSIGNED",
                        "🔄 Mandatory Coaching Reassigned to " + newCoach.getFullName(),
                        "Your mandatory PMS coaching has been reassigned to " + newCoach.getFullName()
                                + " by the PMS Administration. They will coordinate upcoming sessions with you.",
                        "/coaching?view=sessions"
                );
            }

            // 2. Notify Old Coach
            if (oldCoach != null && oldCoach.getUserId() != null) {
                notificationService.notify(
                        oldCoach.getUserId(),
                        NotificationModule.COACHING,
                        "COACHING_REASSIGNED",
                        "📋 Coaching Reassignment Notice: " + (coachee != null ? coachee.getFullName() : "Coachee"),
                        "Coachee " + (coachee != null ? coachee.getFullName() : "Employee")
                                + " has been reassigned to " + newCoach.getFullName() + " for consecutive low-performance remediation.",
                        "/coaching?view=coachees"
                );
            }

            // 3. Notify New Coach
            if (newCoach.getUserId() != null) {
                notificationService.notify(
                        newCoach.getUserId(),
                        NotificationModule.COACHING,
                        "COACHING_NEW_ASSIGNMENT",
                        "🎯 New Coachee Assigned: " + (coachee != null ? coachee.getFullName() : "Coachee"),
                        "You have been assigned as designated coach for " + (coachee != null ? coachee.getFullName() : "Employee")
                                + " (Mandatory PMS Coaching). Please review their scorecard goals and schedule your initial remediation session.",
                        "/coaching?view=coachees"
                );
            }

        } else if ("HR_PIP".equals(type) || "HR_ACTION_TAKEN".equals(type)) {
            referral.setStatus("HR_ACTION_TAKEN");

            // Notify Coachee
            if (coachee != null && coachee.getUserId() != null) {
                notificationService.notify(
                        coachee.getUserId(),
                        NotificationModule.COACHING,
                        "PMS_HR_INTERVENTION",
                        "⚠️ Performance Escalation: HR Action Initiated",
                        "Following persistent performance scores below 3.0, your file has been escalated for HR administrative review.",
                        "/coaching?view=remediation"
                );
            }

        } else if ("DISMISSED".equals(type)) {
            referral.setStatus("DISMISSED");
        } else {
            throw new BusinessException("INVALID_TYPE", "Invalid referral resolution action type: " + type);
        }

        PmsReferralCase saved = referralRepository.save(referral);

        auditService.record(new AuditService.AuditCommand(
                null, actor.getUserId(), actor.getUsername(), null,
                "COACHING", "PMS_REFERRAL_RESOLVED", "SUCCESS", null,
                "PMS_REFERRAL", saved.getId().toString(),
                Map.of("action", type, "notes", request.notes()),
                null, null
        ));

        return toDto(saved);
    }

    private PmsReferralCaseDto toDto(PmsReferralCase r) {
        Employee coachee = employeeRepository.findById(r.getCoacheeEmployeeId()).orElse(null);
        Employee currentCoach = r.getCurrentCoachEmployeeId() != null
                ? employeeRepository.findById(r.getCurrentCoachEmployeeId()).orElse(null)
                : null;
        Employee newCoach = r.getNewCoachEmployeeId() != null
                ? employeeRepository.findById(r.getNewCoachEmployeeId()).orElse(null)
                : null;

        return new PmsReferralCaseDto(
                r.getId(),
                r.getCoacheeEmployeeId(),
                coachee != null ? coachee.getEmployeeNumber() : "",
                coachee != null ? coachee.getFullName() : "Unknown Employee",
                coachee != null ? coachee.getDepartment() : "",
                coachee != null ? coachee.getJobTitle() : "",
                r.getCurrentCoachEmployeeId(),
                currentCoach != null ? currentCoach.getFullName() : "None",
                r.getAssignmentId(),
                r.getConsecutiveLowQuartersCount(),
                r.getLatestScoresJson(),
                r.getCoachingSessionsAttended(),
                r.getStatus(),
                r.getNewCoachEmployeeId(),
                newCoach != null ? newCoach.getFullName() : null,
                r.getPmsAdminUserId(),
                r.getResolutionType(),
                r.getResolutionNotes(),
                r.getEscalatedAt(),
                r.getResolvedAt()
        );
    }
}

