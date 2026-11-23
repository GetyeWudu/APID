package com.boa.apid.coaching.skillrequest.service;

import com.boa.apid.coaching.assignment.entity.AssignmentPathway;
import com.boa.apid.coaching.assignment.entity.AssignmentStatus;
import com.boa.apid.coaching.assignment.entity.CoachingAssignment;
import com.boa.apid.coaching.assignment.entity.CoachingParticipant;
import com.boa.apid.coaching.assignment.entity.ParticipantRole;
import com.boa.apid.coaching.assignment.repository.CoachingAssignmentRepository;
import com.boa.apid.coaching.assignment.repository.CoachingParticipantRepository;
import com.boa.apid.coaching.session.entity.CoachingSession;
import com.boa.apid.coaching.session.entity.SessionParticipant;
import com.boa.apid.coaching.session.entity.SessionStatus;
import com.boa.apid.coaching.session.repository.CoachingSessionRepository;
import com.boa.apid.coaching.session.repository.SessionParticipantRepository;
import com.boa.apid.coaching.skillrequest.dto.*;
import com.boa.apid.coaching.skillrequest.entity.SkillCoachingRequest;
import com.boa.apid.coaching.skillrequest.entity.SkillCoachingRequestStatus;
import com.boa.apid.coaching.skillrequest.entity.SkillCoachingRequestTarget;
import com.boa.apid.coaching.skillrequest.repository.SkillCoachingRequestRepository;
import com.boa.apid.coaching.skillrequest.repository.SkillCoachingRequestTargetRepository;
import com.boa.apid.common.exception.BusinessException;
import com.boa.apid.common.exception.ResourceNotFoundException;
import com.boa.apid.core.audit.service.AuditService;
import com.boa.apid.core.auth.security.ApidUserPrincipal;
import com.boa.apid.core.authorization.entity.User;
import com.boa.apid.core.authorization.repository.UserRepository;
import com.boa.apid.core.config.entity.FiscalQuarter;
import com.boa.apid.core.config.repository.FiscalQuarterRepository;
import com.boa.apid.core.notifications.entity.NotificationModule;
import com.boa.apid.core.notifications.service.NotificationService;
import com.boa.apid.core.organization.dto.EmployeeDto;
import com.boa.apid.core.organization.entity.Employee;
import com.boa.apid.core.organization.entity.EmploymentStatus;
import com.boa.apid.core.organization.repository.EmployeeRepository;
import com.boa.apid.core.organization.service.EmployeeQueryService;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class SkillCoachingRequestService {

    private final SkillCoachingRequestRepository requestRepository;
    private final SkillCoachingRequestTargetRepository targetRepository;
    private final CoachingAssignmentRepository assignmentRepository;
    private final CoachingParticipantRepository participantRepository;
    private final EmployeeRepository employeeRepository;
    private final EmployeeQueryService employeeQueryService;
    private final FiscalQuarterRepository fiscalQuarterRepository;
    private final UserRepository userRepository;
    private final NotificationService notificationService;
    private final AuditService auditService;
    private final com.boa.apid.coaching.communication.service.CoachingCommunicationService coachingCommunicationService;
    private final CoachingSessionRepository sessionRepository;
    private final SessionParticipantRepository sessionParticipantRepository;

    public SkillCoachingRequestService(
            SkillCoachingRequestRepository requestRepository,
            SkillCoachingRequestTargetRepository targetRepository,
            CoachingAssignmentRepository assignmentRepository,
            CoachingParticipantRepository participantRepository,
            EmployeeRepository employeeRepository,
            EmployeeQueryService employeeQueryService,
            FiscalQuarterRepository fiscalQuarterRepository,
            UserRepository userRepository,
            NotificationService notificationService,
            AuditService auditService,
            com.boa.apid.coaching.communication.service.CoachingCommunicationService coachingCommunicationService,
            CoachingSessionRepository sessionRepository,
            SessionParticipantRepository sessionParticipantRepository
    ) {
        this.requestRepository = requestRepository;
        this.targetRepository = targetRepository;
        this.assignmentRepository = assignmentRepository;
        this.participantRepository = participantRepository;
        this.employeeRepository = employeeRepository;
        this.employeeQueryService = employeeQueryService;
        this.fiscalQuarterRepository = fiscalQuarterRepository;
        this.userRepository = userRepository;
        this.notificationService = notificationService;
        this.auditService = auditService;
        this.coachingCommunicationService = coachingCommunicationService;
        this.sessionRepository = sessionRepository;
        this.sessionParticipantRepository = sessionParticipantRepository;
    }

    /**
     * Line manager submits a skill development coaching request for 1 or more employees.
     */
    @Transactional
    public SkillCoachingRequestDto createRequest(CreateSkillCoachingRequestPayload payload, ApidUserPrincipal actor) {
        Employee requester = employeeRepository.findByUserId(actor.getUserId())
                .orElseThrow(() -> new BusinessException("NOT_AN_EMPLOYEE", "Your account is not linked to an employee profile", HttpStatus.BAD_REQUEST));

        FiscalQuarter quarter = fiscalQuarterRepository.findById(payload.coachingFiscalQuarterId())
                .orElseThrow(() -> new ResourceNotFoundException("Target coaching fiscal quarter not found"));

        // Proposed coach: if not provided, defaults to the requester (self as manager-coach)
        Long proposedCoachId = payload.proposedCoachEmployeeId() != null ? payload.proposedCoachEmployeeId() : requester.getId();
        Employee proposedCoach = employeeRepository.findById(proposedCoachId)
                .orElseThrow(() -> new BusinessException("COACH_NOT_FOUND", "Proposed coach employee not found", HttpStatus.BAD_REQUEST));

        if (proposedCoach.getEmploymentStatus() != EmploymentStatus.ACTIVE) {
            throw new BusinessException("COACH_NOT_ACTIVE", "Proposed coach is not an active employee", HttpStatus.BAD_REQUEST);
        }

        SkillCoachingRequest req = new SkillCoachingRequest();
        req.setRequesterEmployeeId(requester.getId());
        req.setProposedCoachEmployeeId(proposedCoach.getId());
        req.setCoachingFiscalQuarterId(quarter.getId());
        req.setSkillTitle(payload.skillTitle().trim());
        req.setBusinessJustification(payload.businessJustification().trim());
        req.setStatus(SkillCoachingRequestStatus.PENDING_APPROVAL);

        SkillCoachingRequest savedReq = requestRepository.save(req);

        List<SkillCoachingRequestTarget> targets = new ArrayList<>();
        Set<Long> uniqueEmployeeIds = new LinkedHashSet<>(payload.targetEmployeeIds());

        for (Long empId : uniqueEmployeeIds) {
            if (empId.equals(proposedCoach.getId())) {
                throw new BusinessException("CANNOT_COACH_SELF", "An employee cannot be coached by themselves: Employee #" + empId, HttpStatus.BAD_REQUEST);
            }
            Employee targetEmp = employeeRepository.findById(empId)
                    .orElseThrow(() -> new BusinessException("EMPLOYEE_NOT_FOUND", "Target employee #" + empId + " not found", HttpStatus.BAD_REQUEST));
            if (targetEmp.getEmploymentStatus() != EmploymentStatus.ACTIVE) {
                throw new BusinessException("EMPLOYEE_NOT_ACTIVE", "Target employee " + targetEmp.getFullName() + " is not active", HttpStatus.BAD_REQUEST);
            }

            SkillCoachingRequestTarget target = new SkillCoachingRequestTarget();
            target.setRequest(savedReq);
            target.setEmployeeId(targetEmp.getId());
            targets.add(targetRepository.save(target));
        }

        savedReq.setTargets(targets);

        // Check if this request qualifies for Line Manager Auto-Approval
        // Line managers coaching their direct reports do NOT need PMS Admin approval.
        boolean allTargetsAreDirectReports = uniqueEmployeeIds.stream()
                .allMatch(empId -> employeeQueryService.isDirectManager(requester.getId(), empId));
        boolean isLineManagerSelfCoaching = proposedCoach.getId().equals(requester.getId());
        boolean isAdmin = actor.getAuthorities().stream().anyMatch(a ->
                a.getAuthority().equals("COACHING_REQUEST_APPROVE") || a.getAuthority().equals("COACHING_ASSIGNMENT_MANAGE"));

        boolean isAutoApproved = (allTargetsAreDirectReports && isLineManagerSelfCoaching) || isAdmin;

        if (isAutoApproved) {
            String autoReviewNotes = isAdmin && !isLineManagerSelfCoaching
                    ? "Directly approved by Administrator"
                    : "Auto-approved: Line manager coaching direct report(s)";
            savedReq = activateSkillCohort(savedReq, proposedCoach, targets, actor.getUserId(), autoReviewNotes, true);

            auditService.record(new AuditService.AuditCommand(
                    null,
                    actor.getUserId(),
                    actor.getUsername(),
                    null,
                    "COACHING",
                    "SKILL_COACHING_REQUEST_AUTO_APPROVED",
                    "SUCCESS",
                    null,
                    "SkillCoachingRequest",
                    savedReq.getId().toString(),
                    Map.of(
                            "skillTitle", savedReq.getSkillTitle(),
                            "targetCount", String.valueOf(targets.size()),
                            "coach", proposedCoach.getFullName(),
                            "autoApproved", "true"
                    ),
                    null, null
            ));
        } else {
            // Cross-department or external specialist coaching requires PMS Admin review
            auditService.record(new AuditService.AuditCommand(
                    null,
                    actor.getUserId(),
                    actor.getUsername(),
                    null,
                    "COACHING",
                    "SKILL_COACHING_REQUEST_CREATED",
                    "SUCCESS",
                    null,
                    "SkillCoachingRequest",
                    savedReq.getId().toString(),
                    Map.of(
                            "skillTitle", savedReq.getSkillTitle(),
                            "targetCount", String.valueOf(targets.size()),
                            "proposedCoach", proposedCoach.getFullName(),
                            "status", "PENDING_APPROVAL"
                    ),
                    null, null
            ));
        }

        return toDto(savedReq);
    }

    /**
     * List all requests awaiting PMS Admin review.
     */
    @Transactional(readOnly = true)
    public List<SkillCoachingRequestDto> getPendingRequests() {
        return requestRepository.findAllByStatusOrderByCreatedAtDesc(SkillCoachingRequestStatus.PENDING_APPROVAL)
                .stream()
                .map(this::toDto)
                .collect(Collectors.toList());
    }

    /**
     * List all requests for PMS Admin with optional status and quarter filter.
     */
    @Transactional(readOnly = true)
    public List<SkillCoachingRequestDto> getAllRequests(SkillCoachingRequestStatus status, Long fiscalQuarterId) {
        List<SkillCoachingRequest> list;
        if (status != null) {
            list = requestRepository.findAllByStatusOrderByCreatedAtDesc(status);
        } else {
            list = requestRepository.findAllByOrderByCreatedAtDesc();
        }
        if (fiscalQuarterId != null) {
            list = list.stream()
                    .filter(r -> r.getCoachingFiscalQuarterId().equals(fiscalQuarterId))
                    .collect(Collectors.toList());
        }
        return list.stream().map(this::toDto).collect(Collectors.toList());
    }

    /**
     * List requests submitted by the logged-in manager.
     */
    @Transactional(readOnly = true)
    public List<SkillCoachingRequestDto> getMySubmittedRequests(ApidUserPrincipal actor) {
        Employee requester = employeeRepository.findByUserId(actor.getUserId())
                .orElseThrow(() -> new BusinessException("NOT_AN_EMPLOYEE", "Your account is not linked to an employee profile", HttpStatus.BAD_REQUEST));

        return requestRepository.findAllByRequesterEmployeeIdOrderByCreatedAtDesc(requester.getId())
                .stream()
                .map(this::toDto)
                .collect(Collectors.toList());
    }

    /**
     * Lists approved skill development cohorts where the caller is an approved target (coachee) or coach.
     * When asTalentOnly is true, only cohorts where the caller is an enrolled talent with at least one eligible peer are returned.
     */
    public List<SkillCoachingRequestDto> getMyApprovedCohorts(ApidUserPrincipal actor, boolean asTalentOnly) {
        Employee employee = employeeRepository.findByUserId(actor.getUserId())
                .orElse(null);
        if (employee == null) {
            return Collections.emptyList();
        }

        List<SkillCoachingRequestTarget> targets = targetRepository.findAllByEmployeeId(employee.getId());
        Set<Long> requestIds = targets.stream()
                .filter(t -> t.getRequest() != null)
                .map(t -> t.getRequest().getId())
                .collect(Collectors.toSet());

        if (!asTalentOnly) {
            List<SkillCoachingRequest> coached = requestRepository.findAllByProposedCoachEmployeeIdAndStatus(
                    employee.getId(), SkillCoachingRequestStatus.APPROVED
            );
            for (SkillCoachingRequest req : coached) {
                requestIds.add(req.getId());
            }
        }

        if (requestIds.isEmpty()) {
            return Collections.emptyList();
        }

        List<SkillCoachingRequestDto> list = requestRepository.findAllById(requestIds)
                .stream()
                .filter(r -> r.getStatus() == SkillCoachingRequestStatus.APPROVED)
                .map(this::toDto)
                .collect(Collectors.toList());

        if (asTalentOnly) {
            list = list.stream()
                    .filter(req -> req.targets() != null && req.targets().stream().anyMatch(t -> !t.employeeId().equals(employee.getId())))
                    .collect(Collectors.toList());
        }

        return list;
    }

    public List<SkillCoachingRequestDto> getMyApprovedCohorts(ApidUserPrincipal actor) {
        return getMyApprovedCohorts(actor, false);
    }

    /**
     * PMS Admin approves a skill development coaching request.
     * Optionally overrides the proposed coach.
     * Generates active SELF_DEVELOPMENT coaching assignments for all target coachees.
     */
    @Transactional
    public SkillCoachingRequestDto approveRequest(Long requestId, ApproveSkillCoachingRequestPayload payload, ApidUserPrincipal actor) {
        SkillCoachingRequest req = requestRepository.findById(requestId)
                .orElseThrow(() -> new ResourceNotFoundException("Skill coaching request not found"));

        if (req.getStatus() != SkillCoachingRequestStatus.PENDING_APPROVAL) {
            throw new BusinessException("INVALID_REQUEST_STATUS", "Request is already " + req.getStatus(), HttpStatus.CONFLICT);
        }

        Long finalCoachId = payload.overrideCoachEmployeeId() != null ? payload.overrideCoachEmployeeId() : req.getProposedCoachEmployeeId();
        Employee finalCoach = null;
        if (finalCoachId != null) {
            finalCoach = employeeRepository.findById(finalCoachId)
                    .orElseThrow(() -> new BusinessException("COACH_NOT_FOUND", "Designated coach employee not found", HttpStatus.BAD_REQUEST));
            if (finalCoach.getEmploymentStatus() != EmploymentStatus.ACTIVE) {
                throw new BusinessException("COACH_NOT_ACTIVE", "Designated coach is not active", HttpStatus.BAD_REQUEST);
            }
        }

        List<SkillCoachingRequestTarget> targets = targetRepository.findAllByRequestId(requestId);

        SkillCoachingRequest savedReq = activateSkillCohort(
                req,
                finalCoach,
                targets,
                actor.getUserId(),
                payload.reviewNotes(),
                false
        );

        // Audit log
        auditService.record(new AuditService.AuditCommand(
                null,
                actor.getUserId(),
                actor.getUsername(),
                null,
                "COACHING",
                "SKILL_COACHING_REQUEST_APPROVED",
                "SUCCESS",
                null,
                "SkillCoachingRequest",
                savedReq.getId().toString(),
                Map.of(
                        "skillTitle", savedReq.getSkillTitle(),
                        "finalCoachId", String.valueOf(finalCoachId),
                        "targetsCreated", String.valueOf(targets.size())
                ),
                null, null
        ));

        return toDto(savedReq);
    }

    /**
     * Activates a skill coaching cohort:
     * - Marks request APPROVED
     * - Generates active CoachingAssignment & CoachingParticipant records
     * - Notifies coachees & coach
     * - Provisions group chat conversation
     */
    private SkillCoachingRequest activateSkillCohort(
            SkillCoachingRequest req,
            Employee coach,
            List<SkillCoachingRequestTarget> targets,
            Long reviewerUserId,
            String reviewNotes,
            boolean isAutoApproved
    ) {
        req.setStatus(SkillCoachingRequestStatus.APPROVED);
        req.setProposedCoachEmployeeId(coach != null ? coach.getId() : null);
        req.setReviewedByUserId(reviewerUserId);
        req.setReviewNotes(reviewNotes);
        req.setReviewedAt(Instant.now());
        SkillCoachingRequest savedReq = requestRepository.save(req);

        // Create assignment for each target coachee
        for (SkillCoachingRequestTarget target : targets) {
            if (coach != null && target.getEmployeeId().equals(coach.getId())) {
                throw new BusinessException("CANNOT_COACH_SELF", "Employee cannot coach themselves", HttpStatus.BAD_REQUEST);
            }

            CoachingAssignment assignment = new CoachingAssignment();
            assignment.setPathway(AssignmentPathway.SELF_DEVELOPMENT);
            assignment.setCoacheeEmployeeId(target.getEmployeeId());
            assignment.setCoachEmployeeId(coach != null ? coach.getId() : null);
            // Performance quarter defaults to active/target coaching quarter
            assignment.setPerformanceFiscalQuarterId(req.getCoachingFiscalQuarterId());
            assignment.setCoachingFiscalQuarterId(req.getCoachingFiscalQuarterId());
            assignment.setStatus(coach != null ? AssignmentStatus.ACTIVE : AssignmentStatus.PENDING_COACH_ASSIGNMENT);
            assignment.setAtRisk(false);

            CoachingAssignment savedAssignment = assignmentRepository.save(assignment);
            target.setCreatedAssignmentId(savedAssignment.getId());
            targetRepository.save(target);

            // Insert coachee participant
            CoachingParticipant coacheePart = new CoachingParticipant();
            coacheePart.setAssignmentId(savedAssignment.getId());
            coacheePart.setEmployeeId(target.getEmployeeId());
            coacheePart.setRole(ParticipantRole.COACHEE);
            coacheePart.setActive(true);
            participantRepository.save(coacheePart);

            // Insert coach participant if coach assigned
            if (coach != null) {
                CoachingParticipant coachPart = new CoachingParticipant();
                coachPart.setAssignmentId(savedAssignment.getId());
                coachPart.setEmployeeId(coach.getId());
                coachPart.setRole(ParticipantRole.COACH);
                coachPart.setActive(true);
                participantRepository.save(coachPart);
            }

            // Notify coachee
            Employee coachee = employeeRepository.findById(target.getEmployeeId()).orElse(null);
            if (coachee != null && coachee.getUserId() != null) {
                String notifTitle = isAutoApproved ? "Skill Coaching Cohort Started" : "Skill Coaching Approved";
                String notifBody = isAutoApproved
                        ? "Your line manager has initiated a skill coaching cohort for '" + req.getSkillTitle() + "'."
                        : "Your skill coaching request for '" + req.getSkillTitle() + "' has been approved by PMS Administration.";
                notificationService.notify(
                        coachee.getUserId(),
                        NotificationModule.COACHING,
                        "SKILL_COACHING_APPROVED",
                        notifTitle,
                        notifBody,
                        "/coaching?view=plan"
                );
            }
        }

        // Notify coach (if coach is different from reviewer/requester)
        if (coach != null && coach.getUserId() != null && (!isAutoApproved || !coach.getUserId().equals(reviewerUserId))) {
            notificationService.notify(
                    coach.getUserId(),
                    NotificationModule.COACHING,
                    "COACHING_COACHEE_ASSIGNED",
                    "New Coachees Assigned",
                    "You have been assigned to coach " + targets.size() + " employee(s) for '" + req.getSkillTitle() + "'.",
                    "/coaching?view=coachees"
            );
        }

        // Provision group conversation for the approved skill cohort
        try {
            coachingCommunicationService.provisionSkillCohortGroupConversation(savedReq.getId(), reviewerUserId);
        } catch (Exception e) {
            // Keep going, non-fatal if conversation already exists
        }

        return savedReq;
    }

    /**
     * PMS Admin rejects a skill development coaching request with mandatory reason.
     */
    @Transactional
    public SkillCoachingRequestDto rejectRequest(Long requestId, RejectSkillCoachingRequestPayload payload, ApidUserPrincipal actor) {
        SkillCoachingRequest req = requestRepository.findById(requestId)
                .orElseThrow(() -> new ResourceNotFoundException("Skill coaching request not found"));

        if (req.getStatus() != SkillCoachingRequestStatus.PENDING_APPROVAL) {
            throw new BusinessException("INVALID_REQUEST_STATUS", "Request is already " + req.getStatus(), HttpStatus.CONFLICT);
        }

        req.setStatus(SkillCoachingRequestStatus.REJECTED);
        req.setReviewedByUserId(actor.getUserId());
        req.setReviewNotes(payload.reviewNotes().trim());
        req.setReviewedAt(Instant.now());
        SkillCoachingRequest savedReq = requestRepository.save(req);

        // Notify requester
        Employee requester = employeeRepository.findById(req.getRequesterEmployeeId()).orElse(null);
        if (requester != null && requester.getUserId() != null) {
            notificationService.notify(
                    requester.getUserId(),
                    NotificationModule.COACHING,
                    "SKILL_COACHING_REJECTED",
                    "Skill Coaching Request Rejected",
                    "Your request for '" + req.getSkillTitle() + "' was not approved: " + payload.reviewNotes().trim(),
                    "/coaching?view=coachees"
            );
        }

        auditService.record(new AuditService.AuditCommand(
                null,
                actor.getUserId(),
                actor.getUsername(),
                null,
                "COACHING",
                "SKILL_COACHING_REQUEST_REJECTED",
                "SUCCESS",
                null,
                "SkillCoachingRequest",
                savedReq.getId().toString(),
                Map.of("reason", payload.reviewNotes().trim()),
                null, null
        ));

        return toDto(savedReq);
    }

    @Transactional
    public SkillCoachingRequestDto addCohortMember(Long requestId, Long employeeId, ApidUserPrincipal actor) {
        SkillCoachingRequest req = requestRepository.findById(requestId)
                .orElseThrow(() -> new ResourceNotFoundException("Skill coaching request not found"));

        if (req.getStatus() != SkillCoachingRequestStatus.APPROVED) {
            throw new BusinessException("COHORT_NOT_APPROVED", "Members can only be added to approved active cohorts", HttpStatus.BAD_REQUEST);
        }

        Employee currentCaller = employeeRepository.findByUserId(actor.getUserId()).orElse(null);
        boolean isCoach = currentCaller != null && currentCaller.getId().equals(req.getProposedCoachEmployeeId());
        boolean isRequester = currentCaller != null && currentCaller.getId().equals(req.getRequesterEmployeeId());
        boolean isAdmin = actor.getAuthorities().stream().anyMatch(a ->
                a.getAuthority().equals("COACHING_REQUEST_APPROVE") || a.getAuthority().equals("COACHING_ASSIGNMENT_MANAGE"));

        if (!isCoach && !isRequester && !isAdmin) {
            throw new BusinessException("NOT_AUTHORIZED", "Only the designated coach or nominating manager can add cohort members", HttpStatus.FORBIDDEN);
        }

        Employee newMember = employeeRepository.findById(employeeId)
                .orElseThrow(() -> new ResourceNotFoundException("Employee not found with id: " + employeeId));

        if (newMember.getEmploymentStatus() != EmploymentStatus.ACTIVE) {
            throw new BusinessException("EMPLOYEE_NOT_ACTIVE", "Cannot add an inactive employee", HttpStatus.BAD_REQUEST);
        }

        if (req.getProposedCoachEmployeeId() != null && req.getProposedCoachEmployeeId().equals(employeeId)) {
            throw new BusinessException("CANNOT_COACH_SELF", "The coach cannot be added as a coachee member", HttpStatus.BAD_REQUEST);
        }

        // Enforce that only direct reports under this coach can be added
        Long coachEmployeeId = req.getProposedCoachEmployeeId();
        if (coachEmployeeId != null && !isAdmin) {
            boolean isDirectReport = employeeQueryService.isDirectManager(coachEmployeeId, employeeId);
            if (!isDirectReport) {
                throw new BusinessException("NOT_DIRECT_REPORT",
                        "Only direct employees reporting to the coach can be added to this cohort. Employees from other departments or managers are not permitted.",
                        HttpStatus.BAD_REQUEST);
            }
        }

        if (targetRepository.existsByRequestIdAndEmployeeId(requestId, employeeId)) {
            throw new BusinessException("ALREADY_ENROLLED", "This employee is already enrolled in this cohort", HttpStatus.CONFLICT);
        }

        long currentCount = targetRepository.countByRequestId(requestId);
        if (currentCount >= 10) {
            throw new BusinessException("COHORT_CAPACITY_EXCEEDED", "Cohort capacity reached (maximum 10 participants per group cohort)", HttpStatus.BAD_REQUEST);
        }

        // 1. Create active assignment for new member
        CoachingAssignment assignment = new CoachingAssignment();
        assignment.setPathway(AssignmentPathway.SELF_DEVELOPMENT);
        assignment.setCoacheeEmployeeId(employeeId);
        assignment.setCoachEmployeeId(req.getProposedCoachEmployeeId());
        assignment.setPerformanceFiscalQuarterId(req.getCoachingFiscalQuarterId());
        assignment.setCoachingFiscalQuarterId(req.getCoachingFiscalQuarterId());
        assignment.setStatus(AssignmentStatus.ACTIVE);
        assignment.setAtRisk(false);
        CoachingAssignment savedAssignment = assignmentRepository.save(assignment);

        // 2. Save Target
        SkillCoachingRequestTarget target = new SkillCoachingRequestTarget();
        target.setRequest(req);
        target.setEmployeeId(employeeId);
        target.setCreatedAssignmentId(savedAssignment.getId());
        targetRepository.save(target);

        // 3. Save coaching participants
        CoachingParticipant coacheePart = new CoachingParticipant();
        coacheePart.setAssignmentId(savedAssignment.getId());
        coacheePart.setEmployeeId(employeeId);
        coacheePart.setRole(ParticipantRole.COACHEE);
        coacheePart.setActive(true);
        participantRepository.save(coacheePart);

        if (req.getProposedCoachEmployeeId() != null) {
            CoachingParticipant coachPart = new CoachingParticipant();
            coachPart.setAssignmentId(savedAssignment.getId());
            coachPart.setEmployeeId(req.getProposedCoachEmployeeId());
            coachPart.setRole(ParticipantRole.COACH);
            coachPart.setActive(true);
            participantRepository.save(coachPart);
        }

        // 4. Sync upcoming sessions: add new member to scheduled sessions
        List<CoachingSession> upcomingSessions = sessionRepository.findAllBySkillRequestId(requestId).stream()
                .filter(s -> s.getStatus() != SessionStatus.CANCELLED && s.getStatus() != SessionStatus.COMPLETED && s.getStatus() != SessionStatus.EXPIRED)
                .toList();

        for (CoachingSession session : upcomingSessions) {
            if (!sessionParticipantRepository.existsBySessionIdAndEmployeeId(session.getId(), employeeId)) {
                SessionParticipant sp = new SessionParticipant();
                sp.setSessionId(session.getId());
                sp.setEmployeeId(employeeId);
                sp.setRole(com.boa.apid.coaching.session.entity.ParticipantRole.COACHEE);
                sp.setInvitationStatus(com.boa.apid.coaching.session.entity.InvitationStatus.ACCEPTED);
                sp.setAttendanceStatus(com.boa.apid.coaching.session.entity.AttendanceStatus.PENDING);
                sessionParticipantRepository.save(sp);
            }
        }

        // 5. Notify the employee
        if (newMember.getUserId() != null) {
            notificationService.notify(
                    newMember.getUserId(),
                    NotificationModule.COACHING,
                    "COHORT_MEMBER_ENROLLED",
                    "Enrolled in Skill Cohort",
                    "You have been enrolled into the '" + req.getSkillTitle() + "' skill cohort.",
                    "/coaching?view=skills&sub=cohorts"
            );
        }

        auditService.record(new AuditService.AuditCommand(
                null,
                actor.getUserId(),
                actor.getUsername(),
                null,
                "COACHING",
                "COHORT_MEMBER_ADDED",
                "SUCCESS",
                null,
                "SkillCoachingRequest",
                requestId.toString(),
                Map.of("addedEmployeeId", employeeId, "addedEmployeeName", newMember.getFullName()),
                null, null
        ));

        return toDto(req);
    }

    @Transactional
    public SkillCoachingRequestDto removeCohortMember(Long requestId, Long employeeId, ApidUserPrincipal actor) {
        SkillCoachingRequest req = requestRepository.findById(requestId)
                .orElseThrow(() -> new ResourceNotFoundException("Skill coaching request not found"));

        Employee currentCaller = employeeRepository.findByUserId(actor.getUserId()).orElse(null);
        boolean isCoach = currentCaller != null && currentCaller.getId().equals(req.getProposedCoachEmployeeId());
        boolean isRequester = currentCaller != null && currentCaller.getId().equals(req.getRequesterEmployeeId());
        boolean isAdmin = actor.getAuthorities().stream().anyMatch(a ->
                a.getAuthority().equals("COACHING_REQUEST_APPROVE") || a.getAuthority().equals("COACHING_ASSIGNMENT_MANAGE"));

        if (!isCoach && !isRequester && !isAdmin) {
            throw new BusinessException("NOT_AUTHORIZED", "Only the designated coach or nominating manager can manage cohort members", HttpStatus.FORBIDDEN);
        }

        SkillCoachingRequestTarget target = targetRepository.findByRequestIdAndEmployeeId(requestId, employeeId)
                .orElseThrow(() -> new ResourceNotFoundException("Employee is not enrolled in this cohort"));

        // Check if member already has COMPLETED sessions in this cohort
        List<CoachingSession> cohortSessions = sessionRepository.findAllBySkillRequestId(requestId);
        boolean hasAttendedOrCompleted = cohortSessions.stream().anyMatch(s -> {
            if (s.getStatus() == SessionStatus.COMPLETED) {
                return sessionParticipantRepository.findBySessionIdAndEmployeeId(s.getId(), employeeId)
                        .map(p -> p.getAttendanceStatus() == com.boa.apid.coaching.session.entity.AttendanceStatus.ATTENDED)
                        .orElse(false);
            }
            return false;
        });

        if (hasAttendedOrCompleted) {
            throw new BusinessException("CANNOT_REMOVE_ATTENDED_MEMBER",
                    "Cannot remove an employee who has already attended completed sessions in this cohort. You can mark their assignment inactive instead.",
                    HttpStatus.CONFLICT);
        }

        // Remove from future sessions
        for (CoachingSession s : cohortSessions) {
            if (s.getStatus() != SessionStatus.COMPLETED) {
                sessionParticipantRepository.findBySessionIdAndEmployeeId(s.getId(), employeeId)
                        .ifPresent(sessionParticipantRepository::delete);
            }
        }

        // Close assignment
        if (target.getCreatedAssignmentId() != null) {
            assignmentRepository.findById(target.getCreatedAssignmentId()).ifPresent(a -> {
                a.setStatus(AssignmentStatus.CLOSED);
                assignmentRepository.save(a);
            });
        }

        targetRepository.delete(target);

        auditService.record(new AuditService.AuditCommand(
                null,
                actor.getUserId(),
                actor.getUsername(),
                null,
                "COACHING",
                "COHORT_MEMBER_REMOVED",
                "SUCCESS",
                null,
                "SkillCoachingRequest",
                requestId.toString(),
                Map.of("removedEmployeeId", employeeId),
                null, null
        ));

        return toDto(req);
    }

    @Transactional(readOnly = true)
    public List<EmployeeDto> getEligibleCohortMembers(Long requestId, ApidUserPrincipal actor) {
        SkillCoachingRequest req = requestRepository.findById(requestId)
                .orElseThrow(() -> new ResourceNotFoundException("Skill coaching request not found with id: " + requestId));

        Long coachId = req.getProposedCoachEmployeeId();
        if (coachId == null) {
            return List.of();
        }

        // Retrieve active direct reports under the coach
        List<EmployeeDto> directReports = employeeQueryService.getDirectReports(coachId);

        // Filter out the coach themselves and already enrolled coachees
        return directReports.stream()
                .filter(dr -> dr.employmentStatus() == EmploymentStatus.ACTIVE)
                .filter(dr -> !dr.id().equals(coachId))
                .filter(dr -> !targetRepository.existsByRequestIdAndEmployeeId(requestId, dr.id()))
                .toList();
    }

    private SkillCoachingRequestDto toDto(SkillCoachingRequest req) {
        Employee requester = employeeRepository.findById(req.getRequesterEmployeeId()).orElse(null);
        Employee coach = req.getProposedCoachEmployeeId() != null ? employeeRepository.findById(req.getProposedCoachEmployeeId()).orElse(null) : null;
        FiscalQuarter quarter = fiscalQuarterRepository.findById(req.getCoachingFiscalQuarterId()).orElse(null);
        User reviewer = req.getReviewedByUserId() != null ? userRepository.findById(req.getReviewedByUserId()).orElse(null) : null;

        List<SkillCoachingRequestTarget> targets = targetRepository.findAllByRequestId(req.getId());
        List<SkillCoachingRequestDto.SkillCoachingTargetItemDto> targetDtos = targets.stream().map(t -> {
            Employee emp = employeeRepository.findById(t.getEmployeeId()).orElse(null);
            return new SkillCoachingRequestDto.SkillCoachingTargetItemDto(
                    t.getId(),
                    t.getEmployeeId(),
                    emp != null ? emp.getFullName() : "Employee #" + t.getEmployeeId(),
                    emp != null ? emp.getEmployeeNumber() : "—",
                    emp != null ? emp.getDepartmentName() : "—",
                    emp != null ? emp.getPosition() : "—",
                    t.getCreatedAssignmentId()
            );
        }).collect(Collectors.toList());

        return new SkillCoachingRequestDto(
                req.getId(),
                req.getRequesterEmployeeId(),
                requester != null ? requester.getFullName() : "Unknown",
                requester != null ? requester.getEmployeeNumber() : "—",
                requester != null ? requester.getDepartmentName() : "—",
                req.getProposedCoachEmployeeId(),
                coach != null ? coach.getFullName() : "Unassigned",
                coach != null ? coach.getEmployeeNumber() : "—",
                req.getCoachingFiscalQuarterId(),
                quarter != null ? quarter.getLabel() : "—",
                req.getSkillTitle(),
                req.getBusinessJustification(),
                req.getStatus(),
                req.getReviewedByUserId(),
                reviewer != null ? reviewer.getUsername() : null,
                req.getReviewNotes(),
                req.getReviewedAt(),
                req.getCreatedAt(),
                targetDtos
        );
    }
}

