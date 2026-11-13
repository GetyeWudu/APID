package com.boa.apid.coaching.skillrequest.service;

import com.boa.apid.coaching.assignment.entity.AssignmentPathway;
import com.boa.apid.coaching.assignment.entity.AssignmentStatus;
import com.boa.apid.coaching.assignment.entity.CoachingAssignment;
import com.boa.apid.coaching.assignment.entity.CoachingParticipant;
import com.boa.apid.coaching.assignment.entity.ParticipantRole;
import com.boa.apid.coaching.assignment.repository.CoachingAssignmentRepository;
import com.boa.apid.coaching.assignment.repository.CoachingParticipantRepository;
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
            AuditService auditService
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

        // Audit log
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
                        "proposedCoach", proposedCoach.getFullName()
                ),
                null, null
        ));

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

        // Create assignment for each target coachee
        for (SkillCoachingRequestTarget target : targets) {
            if (finalCoach != null && target.getEmployeeId().equals(finalCoach.getId())) {
                throw new BusinessException("CANNOT_COACH_SELF", "Employee cannot coach themselves", HttpStatus.BAD_REQUEST);
            }

            CoachingAssignment assignment = new CoachingAssignment();
            assignment.setPathway(AssignmentPathway.SELF_DEVELOPMENT);
            assignment.setCoacheeEmployeeId(target.getEmployeeId());
            assignment.setCoachEmployeeId(finalCoach != null ? finalCoach.getId() : null);
            // Performance quarter defaults to active/target coaching quarter
            assignment.setPerformanceFiscalQuarterId(req.getCoachingFiscalQuarterId());
            assignment.setCoachingFiscalQuarterId(req.getCoachingFiscalQuarterId());
            assignment.setStatus(finalCoach != null ? AssignmentStatus.ACTIVE : AssignmentStatus.PENDING_COACH_ASSIGNMENT);
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
            if (finalCoach != null) {
                CoachingParticipant coachPart = new CoachingParticipant();
                coachPart.setAssignmentId(savedAssignment.getId());
                coachPart.setEmployeeId(finalCoach.getId());
                coachPart.setRole(ParticipantRole.COACH);
                coachPart.setActive(true);
                participantRepository.save(coachPart);
            }

            // Notify coachee
            Employee coachee = employeeRepository.findById(target.getEmployeeId()).orElse(null);
            if (coachee != null && coachee.getUserId() != null) {
                notificationService.notify(
                        coachee.getUserId(),
                        NotificationModule.COACHING,
                        "SKILL_COACHING_APPROVED",
                        "Skill Coaching Approved",
                        "Your skill coaching request for '" + req.getSkillTitle() + "' has been approved by PMS Administration.",
                        "/coaching?view=plan"
                );
            }
        }

        // Notify coach
        if (finalCoach != null && finalCoach.getUserId() != null) {
            notificationService.notify(
                    finalCoach.getUserId(),
                    NotificationModule.COACHING,
                    "COACHING_COACHEE_ASSIGNED",
                    "New Coachees Assigned",
                    "You have been assigned to coach " + targets.size() + " employee(s) for '" + req.getSkillTitle() + "'.",
                    "/coaching?view=coachees"
            );
        }

        req.setStatus(SkillCoachingRequestStatus.APPROVED);
        req.setProposedCoachEmployeeId(finalCoachId);
        req.setReviewedByUserId(actor.getUserId());
        req.setReviewNotes(payload.reviewNotes());
        req.setReviewedAt(Instant.now());
        SkillCoachingRequest savedReq = requestRepository.save(req);

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

