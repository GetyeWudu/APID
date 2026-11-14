package com.boa.apid.coaching.governance.service;

import com.boa.apid.coaching.assignment.entity.AssignmentPathway;
import com.boa.apid.coaching.assignment.entity.CoachingAssignment;
import com.boa.apid.coaching.assignment.repository.CoachingAssignmentRepository;
import com.boa.apid.coaching.governance.dto.*;
import com.boa.apid.coaching.governance.entity.*;
import com.boa.apid.coaching.governance.repository.*;
import com.boa.apid.coaching.importpms.entity.PmsPerformanceRecord;
import com.boa.apid.coaching.importpms.repository.PmsPerformanceRecordRepository;
import com.boa.apid.coaching.session.entity.SessionStatus;
import com.boa.apid.coaching.session.repository.CoachingSessionRepository;
import com.boa.apid.coaching.skillrequest.entity.SkillCoachingRequest;
import com.boa.apid.coaching.skillrequest.repository.SkillCoachingRequestRepository;
import com.boa.apid.common.exception.BusinessException;
import com.boa.apid.common.exception.ResourceNotFoundException;
import com.boa.apid.core.audit.service.AuditService;
import com.boa.apid.core.auth.security.ApidUserPrincipal;
import com.boa.apid.core.organization.dto.EmployeeDto;
import com.boa.apid.core.organization.service.EmployeeQueryService;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@Service
public class CoachingGovernanceService {

    private final CoachingPolicyVersionRepository policyRepository;
    private final CoachingSessionTargetRepository targetRepository;
    private final CoachingTargetAdjustmentRepository adjustmentRepository;
    private final CoachingAssignmentRepository assignmentRepository;
    private final SkillCoachingRequestRepository skillRequestRepository;
    private final PmsPerformanceRecordRepository performanceRecordRepository;
    private final CoachingSessionRepository sessionRepository;
    private final EmployeeQueryService employeeQueryService;
    private final AuditService auditService;

    public CoachingGovernanceService(
            CoachingPolicyVersionRepository policyRepository,
            CoachingSessionTargetRepository targetRepository,
            CoachingTargetAdjustmentRepository adjustmentRepository,
            CoachingAssignmentRepository assignmentRepository,
            SkillCoachingRequestRepository skillRequestRepository,
            PmsPerformanceRecordRepository performanceRecordRepository,
            CoachingSessionRepository sessionRepository,
            EmployeeQueryService employeeQueryService,
            AuditService auditService
    ) {
        this.policyRepository = policyRepository;
        this.targetRepository = targetRepository;
        this.adjustmentRepository = adjustmentRepository;
        this.assignmentRepository = assignmentRepository;
        this.skillRequestRepository = skillRequestRepository;
        this.performanceRecordRepository = performanceRecordRepository;
        this.sessionRepository = sessionRepository;
        this.employeeQueryService = employeeQueryService;
        this.auditService = auditService;
    }

    public List<CoachingPolicyVersionDto> getActivePolicies(AssignmentPathway pathway) {
        List<CoachingPolicyVersion> list = pathway != null
                ? policyRepository.findAllByPathwayAndIsActiveTrue(pathway)
                : policyRepository.findAllByIsActiveTrue();

        return list.stream().map(this::toPolicyDto).toList();
    }

    @Transactional
    public CoachingPolicyVersionDto updatePolicy(Long id, UpdateCoachingPolicyRequest request, ApidUserPrincipal actor) {
        CoachingPolicyVersion policy = policyRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Coaching policy not found with id " + id));

        if (request.policyName() != null && !request.policyName().isBlank()) {
            policy.setPolicyName(request.policyName().trim());
        }
        if (request.minAppraisalRating() != null) {
            policy.setMinAppraisalRating(request.minAppraisalRating());
        }
        if (request.maxAppraisalRating() != null) {
            policy.setMaxAppraisalRating(request.maxAppraisalRating());
        }
        if (request.baselineSessions() > 0) {
            policy.setBaselineSessions(request.baselineSessions());
        }
        if (request.minAllowedSessions() > 0) {
            policy.setMinAllowedSessions(request.minAllowedSessions());
        }
        if (request.maxAllowedSessions() >= request.minAllowedSessions() && request.maxAllowedSessions() > 0) {
            policy.setMaxAllowedSessions(request.maxAllowedSessions());
        }
        if (request.defaultCadence() != null) {
            policy.setDefaultCadence(request.defaultCadence());
        }
        if (request.coachAdjustmentAllowed() != null) {
            policy.setCoachAdjustmentAllowed(request.coachAdjustmentAllowed());
        }
        if (request.requiresPmsApprovalOutsideRange() != null) {
            policy.setRequiresPmsApprovalOutsideRange(request.requiresPmsApprovalOutsideRange());
        }
        if (request.allowExtensions() != null) {
            policy.setAllowExtensions(request.allowExtensions());
        }
        if (request.allowEarlyCompletion() != null) {
            policy.setAllowEarlyCompletion(request.allowEarlyCompletion());
        }

        CoachingPolicyVersion saved = policyRepository.save(policy);

        auditService.record(new AuditService.AuditCommand(
                null,
                actor.getUserId(),
                actor.getUsername(),
                null,
                "COACHING",
                "UPDATE_COACHING_POLICY",
                "SUCCESS",
                null,
                "COACHING_POLICY_VERSION",
                saved.getId().toString(),
                Map.of("policyName", saved.getPolicyName(), "baselineSessions", saved.getBaselineSessions()),
                null,
                null
        ));

        return toPolicyDto(saved);
    }

    @Transactional
    public CoachingPolicyVersionDto createPolicy(CreateCoachingPolicyRequest request, ApidUserPrincipal actor) {
        CoachingPolicyVersion policy = new CoachingPolicyVersion();
        policy.setVersionTag(request.versionTag() != null && !request.versionTag().isBlank() ? request.versionTag() : "v2026.Q2.custom");
        policy.setPolicyName(request.policyName().trim());
        policy.setPathway(request.pathway());
        policy.setMinAppraisalRating(request.minAppraisalRating());
        policy.setMaxAppraisalRating(request.maxAppraisalRating());
        policy.setBaselineSessions(request.baselineSessions() > 0 ? request.baselineSessions() : 6);
        policy.setMinAllowedSessions(request.minAllowedSessions() > 0 ? request.minAllowedSessions() : 4);
        policy.setMaxAllowedSessions(request.maxAllowedSessions() >= policy.getMinAllowedSessions() ? request.maxAllowedSessions() : 8);
        policy.setDefaultCadence(request.defaultCadence() != null ? request.defaultCadence() : CadenceType.WEEKLY);
        policy.setCoachAdjustmentAllowed(request.coachAdjustmentAllowed() != null ? request.coachAdjustmentAllowed() : true);
        policy.setRequiresPmsApprovalOutsideRange(request.requiresPmsApprovalOutsideRange() != null ? request.requiresPmsApprovalOutsideRange() : true);
        policy.setAllowExtensions(request.allowExtensions() != null ? request.allowExtensions() : true);
        policy.setAllowEarlyCompletion(request.allowEarlyCompletion() != null ? request.allowEarlyCompletion() : true);
        policy.setActive(true);

        CoachingPolicyVersion saved = policyRepository.save(policy);

        auditService.record(new AuditService.AuditCommand(
                null,
                actor.getUserId(),
                actor.getUsername(),
                null,
                "COACHING",
                "CREATE_COACHING_POLICY",
                "SUCCESS",
                null,
                "COACHING_POLICY_VERSION",
                saved.getId().toString(),
                Map.of("policyName", saved.getPolicyName(), "baselineSessions", saved.getBaselineSessions()),
                null,
                null
        ));

        return toPolicyDto(saved);
    }

    @Transactional
    public CoachingSessionTargetDto getOrCreateTarget(Long assignmentId, Long skillRequestId) {
        if (assignmentId != null) {
            Optional<CoachingSessionTarget> existing = targetRepository.findByAssignmentId(assignmentId);
            if (existing.isPresent()) {
                return toTargetDto(existing.get());
            }
            return toTargetDto(initAssignmentTarget(assignmentId));
        } else if (skillRequestId != null) {
            Optional<CoachingSessionTarget> existing = targetRepository.findBySkillRequestId(skillRequestId);
            if (existing.isPresent()) {
                return toTargetDto(existing.get());
            }
            return toTargetDto(initSkillRequestTarget(skillRequestId));
        }
        throw new BusinessException("INVALID_PARENT", "Either assignmentId or skillRequestId must be provided.");
    }

    @Transactional
    public CoachingSessionTargetDto proposeTargetAdjustment(ProposeTargetRequest request, ApidUserPrincipal actor) {
        EmployeeDto caller = getCallerEmployeeOrThrow(actor);
        CoachingSessionTarget target = getTargetEntity(request.assignmentId(), request.skillRequestId());

        CoachingPolicyVersion policy = target.getPolicyVersion();
        if (policy != null && !policy.isCoachAdjustmentAllowed() && !isAdmin(actor)) {
            throw new BusinessException("ADJUSTMENT_NOT_ALLOWED", "Policy rules do not permit coach target adjustments for this category.");
        }

        int previousTarget = target.getApprovedTarget();
        int proposed = request.proposedTarget();

        boolean requiresPmsReview = false;
        if (policy != null && policy.isRequiresPmsApprovalOutsideRange()) {
            if (proposed < policy.getMinAllowedSessions() || proposed > policy.getMaxAllowedSessions()) {
                requiresPmsReview = true;
            }
        }

        CoachingTargetAdjustment adj = new CoachingTargetAdjustment();
        adj.setSessionTargetId(target.getId());
        adj.setAdjustmentType(AdjustmentType.INITIAL_PROPOSAL);
        adj.setRequestedByEmployeeId(caller.id());
        adj.setPreviousTarget(previousTarget);
        adj.setProposedTarget(proposed);
        adj.setReason(request.justificationReason().trim());

        if (requiresPmsReview && !isAdmin(actor)) {
            adj.setPmsDecision(AdjustmentDecision.PENDING);
            target.setStatus(TargetStatus.PENDING_APPROVAL);
        } else {
            adj.setPmsDecision(AdjustmentDecision.AUTO_APPROVED);
            adj.setDecidedAt(Instant.now());
            target.setApprovedTarget(proposed);
            target.setStatus(TargetStatus.APPROVED);
            target.setJustificationNotes(request.justificationReason().trim());
            target.setApprovedByUserId(actor.getUserId());
            target.setApprovedAt(Instant.now());
        }

        adjustmentRepository.save(adj);
        targetRepository.save(target);

        auditService.record(new AuditService.AuditCommand(
                null,
                actor.getUserId(),
                actor.getUsername(),
                null,
                "COACHING",
                "PROPOSE_TARGET_ADJUSTMENT",
                "SUCCESS",
                null,
                "COACHING_SESSION_TARGET",
                target.getId().toString(),
                Map.of("previous", previousTarget, "proposed", proposed, "status", adj.getPmsDecision().name()),
                null,
                null
        ));

        return toTargetDto(target);
    }

    @Transactional
    public CoachingSessionTargetDto reviewAdjustment(Long adjustmentId, ReviewAdjustmentRequest request, ApidUserPrincipal actor) {
        if (!isAdmin(actor)) {
            throw new AccessDeniedException("Only PMS Administrators can approve or reject coaching target exceptions.");
        }
        Long adminEmpId = employeeQueryService.findByUserId(actor.getUserId())
                .map(EmployeeDto::id)
                .orElse(null);

        CoachingTargetAdjustment adj = adjustmentRepository.findById(adjustmentId)
                .orElseThrow(() -> new ResourceNotFoundException("Target adjustment record not found"));

        if (adj.getPmsDecision() != AdjustmentDecision.PENDING) {
            throw new BusinessException("ALREADY_DECIDED", "This adjustment request has already been processed.");
        }

        CoachingSessionTarget target = targetRepository.findById(adj.getSessionTargetId())
                .orElseThrow(() -> new ResourceNotFoundException("Session target not found"));

        adj.setPmsDecision(request.decision());
        adj.setPmsReviewerId(adminEmpId);
        adj.setDecisionNotes(request.decisionNotes());
        adj.setDecidedAt(Instant.now());
        adjustmentRepository.save(adj);

        if (request.decision() == AdjustmentDecision.APPROVED) {
            if (adj.getAdjustmentType() == AdjustmentType.EXTENSION_REQUEST) {
                target.setApprovedTarget(adj.getProposedTarget());
                target.setStatus(TargetStatus.EXTENDED);
            } else if (adj.getAdjustmentType() == AdjustmentType.EARLY_COMPLETION_REQUEST) {
                target.setStatus(TargetStatus.COMPLETED_EARLY);
                target.setEarlyCompletedAt(Instant.now());
                target.setEarlyCompletionReason(adj.getReason());
            } else {
                target.setApprovedTarget(adj.getProposedTarget());
                target.setStatus(TargetStatus.APPROVED);
            }
            target.setApprovedByUserId(actor.getUserId());
            target.setApprovedAt(Instant.now());
            targetRepository.save(target);
        } else {
            // Revert status to APPROVED with original target
            target.setStatus(TargetStatus.APPROVED);
            targetRepository.save(target);
        }

        return toTargetDto(target);
    }

    @Transactional
    public CoachingSessionTargetDto requestExtension(Long targetId, RequestExtensionRequest request, ApidUserPrincipal actor) {
        CoachingSessionTarget target = targetRepository.findById(targetId)
                .orElseThrow(() -> new ResourceNotFoundException("Session target not found"));
        Long callerEmpId = employeeQueryService.findByUserId(actor.getUserId())
                .map(EmployeeDto::id)
                .orElse(target.getAssignmentId() != null ? 3L : 1L);

        int previousTarget = target.getApprovedTarget();
        int newTarget = previousTarget + request.additionalSessions();

        CoachingTargetAdjustment adj = new CoachingTargetAdjustment();
        adj.setSessionTargetId(target.getId());
        adj.setAdjustmentType(AdjustmentType.EXTENSION_REQUEST);
        adj.setRequestedByEmployeeId(callerEmpId);
        adj.setPreviousTarget(previousTarget);
        adj.setProposedTarget(newTarget);
        adj.setReason(request.reason() + (request.remainingObjectivesSummary() != null ? " | Objectives: " + request.remainingObjectivesSummary() : ""));

        if (isAdmin(actor)) {
            adj.setPmsDecision(AdjustmentDecision.AUTO_APPROVED);
            adj.setDecidedAt(Instant.now());
            target.setApprovedTarget(newTarget);
            target.setStatus(TargetStatus.EXTENDED);
        } else {
            adj.setPmsDecision(AdjustmentDecision.PENDING);
            target.setStatus(TargetStatus.PENDING_APPROVAL);
        }

        adjustmentRepository.save(adj);
        targetRepository.save(target);

        return toTargetDto(target);
    }

    @Transactional
    public CoachingSessionTargetDto requestEarlyCompletion(Long targetId, RequestEarlyCompletionRequest request, ApidUserPrincipal actor) {
        CoachingSessionTarget target = targetRepository.findById(targetId)
                .orElseThrow(() -> new ResourceNotFoundException("Session target not found"));
        Long callerEmpId = employeeQueryService.findByUserId(actor.getUserId())
                .map(EmployeeDto::id)
                .orElse(target.getAssignmentId() != null ? 3L : 1L);

        CoachingTargetAdjustment adj = new CoachingTargetAdjustment();
        adj.setSessionTargetId(target.getId());
        adj.setAdjustmentType(AdjustmentType.EARLY_COMPLETION_REQUEST);
        adj.setRequestedByEmployeeId(callerEmpId);
        adj.setPreviousTarget(target.getApprovedTarget());
        adj.setProposedTarget(target.getApprovedTarget());
        adj.setReason("Early completion requested: " + request.reason() + (request.masteryEvidenceSummary() != null ? " | Evidence: " + request.masteryEvidenceSummary() : ""));

        // If admin or permitted, complete early and cancel future unheld meetings
        if (isAdmin(actor)) {
            adj.setPmsDecision(AdjustmentDecision.AUTO_APPROVED);
            adj.setDecidedAt(Instant.now());
            target.setStatus(TargetStatus.COMPLETED_EARLY);
            target.setEarlyCompletionReason(request.reason());
            target.setEarlyCompletedAt(Instant.now());

            // Cancel future scheduled sessions for this target
            cancelFutureSessionsForTarget(target, "Early completion achieved: " + request.reason());
        } else {
            adj.setPmsDecision(AdjustmentDecision.PENDING);
            target.setStatus(TargetStatus.PENDING_APPROVAL);
        }

        adjustmentRepository.save(adj);
        targetRepository.save(target);

        return toTargetDto(target);
    }

    private void cancelFutureSessionsForTarget(CoachingSessionTarget target, String reason) {
        List<com.boa.apid.coaching.session.entity.CoachingSession> sessions;
        if (target.getAssignmentId() != null) {
            sessions = sessionRepository.findAllByAssignmentId(target.getAssignmentId());
        } else {
            sessions = sessionRepository.findAllBySkillRequestId(target.getSkillRequestId());
        }
        for (var s : sessions) {
            if (s.getStatus() == SessionStatus.CONFIRMED || s.getStatus() == SessionStatus.PROPOSED) {
                s.setStatus(SessionStatus.CANCELLED);
                s.setCancellationReason(reason);
                s.setCancelledAt(Instant.now());
                sessionRepository.save(s);
            }
        }
    }

    private CoachingSessionTarget initAssignmentTarget(Long assignmentId) {
        CoachingAssignment assignment = assignmentRepository.findById(assignmentId)
                .orElseThrow(() -> new ResourceNotFoundException("Assignment not found"));

        BigDecimal rating = BigDecimal.valueOf(2.5);
        if (assignment.getPerformanceRecordId() != null) {
            Optional<PmsPerformanceRecord> rec = performanceRecordRepository.findById(assignment.getPerformanceRecordId());
            if (rec.isPresent() && rec.get().getOverallFinalRating() != null) {
                rating = rec.get().getOverallFinalRating();
            }
        }

        CoachingPolicyVersion policy = policyRepository.findBestMatchingPolicy(assignment.getPathway(), rating)
                .orElseGet(() -> {
                    List<CoachingPolicyVersion> all = policyRepository.findAllByIsActiveTrue();
                    return all.isEmpty() ? null : all.get(0);
                });

        int baseline = policy != null ? policy.getBaselineSessions() : 6;
        CoachingSessionTarget target = new CoachingSessionTarget();
        target.setAssignmentId(assignmentId);
        target.setPolicyVersion(policy);
        target.setPolicyBaseline(baseline);
        target.setApprovedTarget(baseline);
        target.setStatus(TargetStatus.APPROVED);
        target.setJustificationNotes("Initial baseline established by performance appraisal rating");
        return targetRepository.save(target);
    }

    private CoachingSessionTarget initSkillRequestTarget(Long skillRequestId) {
        CoachingPolicyVersion policy = policyRepository.findBestMatchingPolicy(AssignmentPathway.SELF_DEVELOPMENT, BigDecimal.valueOf(3.5))
                .orElse(null);

        int baseline = policy != null ? policy.getBaselineSessions() : 4;
        CoachingSessionTarget target = new CoachingSessionTarget();
        target.setSkillRequestId(skillRequestId);
        target.setPolicyVersion(policy);
        target.setPolicyBaseline(baseline);
        target.setApprovedTarget(baseline);
        target.setStatus(TargetStatus.APPROVED);
        target.setJustificationNotes("Skill development cohort baseline initialized");
        return targetRepository.save(target);
    }

    private CoachingSessionTarget getTargetEntity(Long assignmentId, Long skillRequestId) {
        if (assignmentId != null) {
            return targetRepository.findByAssignmentId(assignmentId)
                    .orElseGet(() -> initAssignmentTarget(assignmentId));
        } else if (skillRequestId != null) {
            return targetRepository.findBySkillRequestId(skillRequestId)
                    .orElseGet(() -> initSkillRequestTarget(skillRequestId));
        }
        throw new BusinessException("INVALID_PARENT", "Either assignmentId or skillRequestId must be provided.");
    }

    private CoachingSessionTargetDto toTargetDto(CoachingSessionTarget t) {
        // Calculate planned and completed sessions
        List<com.boa.apid.coaching.session.entity.CoachingSession> sessions;
        if (t.getAssignmentId() != null) {
            sessions = sessionRepository.findAllByAssignmentId(t.getAssignmentId());
        } else if (t.getSkillRequestId() != null) {
            sessions = sessionRepository.findAllBySkillRequestId(t.getSkillRequestId());
        } else {
            sessions = List.of();
        }

        int planned = (int) sessions.stream().filter(s -> s.getStatus() != SessionStatus.CANCELLED).count();
        int completed = (int) sessions.stream().filter(s -> s.getStatus() == SessionStatus.COMPLETED).count();
        int remaining = Math.max(0, t.getApprovedTarget() - completed);

        List<CoachingTargetAdjustmentDto> adjDtos = adjustmentRepository.findAllBySessionTargetIdOrderByCreatedAtDesc(t.getId())
                .stream()
                .map(this::toAdjustmentDto)
                .toList();

        String policyName = t.getPolicyVersion() != null ? t.getPolicyVersion().getPolicyName() : "Standard Bank Policy";

        return new CoachingSessionTargetDto(
                t.getId(),
                t.getAssignmentId(),
                t.getSkillRequestId(),
                t.getPolicyVersion() != null ? t.getPolicyVersion().getId() : null,
                policyName,
                t.getPolicyBaseline(),
                t.getApprovedTarget(),
                planned,
                completed,
                remaining,
                t.getStatus(),
                t.getJustificationNotes(),
                t.getApprovedByUserId(),
                t.getApprovedAt(),
                t.getEarlyCompletionReason(),
                t.getEarlyCompletedAt(),
                adjDtos,
                t.getCreatedAt()
        );
    }

    private CoachingTargetAdjustmentDto toAdjustmentDto(CoachingTargetAdjustment a) {
        String requesterName = "Staff #" + a.getRequestedByEmployeeId();
        try {
            var emp = employeeQueryService.findById(a.getRequestedByEmployeeId());
            if (emp.isPresent()) {
                requesterName = emp.get().fullName();
            }
        } catch (Exception ignored) {}

        String reviewerName = null;
        if (a.getPmsReviewerId() != null) {
            try {
                var rev = employeeQueryService.findById(a.getPmsReviewerId());
                if (rev.isPresent()) {
                    reviewerName = rev.get().fullName();
                }
            } catch (Exception ignored) {}
        }

        return new CoachingTargetAdjustmentDto(
                a.getId(),
                a.getSessionTargetId(),
                a.getAdjustmentType(),
                a.getRequestedByEmployeeId(),
                requesterName,
                a.getPreviousTarget(),
                a.getProposedTarget(),
                a.getReason(),
                a.getPmsReviewerId(),
                reviewerName,
                a.getPmsDecision(),
                a.getDecisionNotes(),
                a.getDecidedAt(),
                a.getCreatedAt()
        );
    }

    private CoachingPolicyVersionDto toPolicyDto(CoachingPolicyVersion pv) {
        return new CoachingPolicyVersionDto(
                pv.getId(),
                pv.getVersionTag(),
                pv.getPolicyName(),
                pv.getPathway(),
                pv.getMinAppraisalRating(),
                pv.getMaxAppraisalRating(),
                pv.getBaselineSessions(),
                pv.getMinAllowedSessions(),
                pv.getMaxAllowedSessions(),
                pv.getDefaultCadence(),
                pv.isCoachAdjustmentAllowed(),
                pv.isRequiresPmsApprovalOutsideRange(),
                pv.isAllowExtensions(),
                pv.isAllowEarlyCompletion(),
                pv.isActive(),
                pv.getCreatedAt()
        );
    }

    private EmployeeDto getCallerEmployeeOrThrow(ApidUserPrincipal actor) {
        return employeeQueryService.findByUserId(actor.getUserId())
                .orElseThrow(() -> new AccessDeniedException("No employee profile linked to user account."));
    }

    private boolean isAdmin(ApidUserPrincipal actor) {
        return actor != null && actor.getAuthorities().stream()
                .anyMatch(a -> a.getAuthority().equals("ROLE_ADMIN")
                        || a.getAuthority().equals("Super Admin")
                        || a.getAuthority().equals("PMS_REPORT_UPLOAD")
                        || a.getAuthority().equals("COACHING_REQUEST_APPROVE"));
    }
}
