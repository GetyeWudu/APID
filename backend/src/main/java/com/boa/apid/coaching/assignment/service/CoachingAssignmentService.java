package com.boa.apid.coaching.assignment.service;

import com.boa.apid.coaching.assignment.dto.*;
import com.boa.apid.coaching.assignment.entity.*;
import com.boa.apid.coaching.assignment.repository.CoachReplacementHistoryRepository;
import com.boa.apid.coaching.assignment.repository.CoachingAssignmentRepository;
import com.boa.apid.coaching.assignment.repository.CoachingParticipantRepository;
import com.boa.apid.coaching.importpms.dto.PmsGoalLineDto;
import com.boa.apid.coaching.importpms.entity.PmsGoalLine;
import com.boa.apid.coaching.importpms.entity.PmsPerformanceRecord;
import com.boa.apid.coaching.importpms.repository.PmsGoalLineRepository;
import com.boa.apid.coaching.importpms.repository.PmsPerformanceRecordRepository;
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
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import jakarta.persistence.criteria.Predicate;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;

import java.time.Instant;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class CoachingAssignmentService {

    @PersistenceContext
    private EntityManager entityManager;

    private final CoachingAssignmentRepository assignmentRepository;
    private final CoachingParticipantRepository participantRepository;
    private final CoachReplacementHistoryRepository replacementHistoryRepository;
    private final PmsPerformanceRecordRepository performanceRecordRepository;
    private final PmsGoalLineRepository goalLineRepository;
    private final EmployeeRepository employeeRepository;
    private final EmployeeQueryService employeeQueryService;
    private final UserRepository userRepository;
    private final FiscalQuarterRepository fiscalQuarterRepository;
    private final NotificationService notificationService;
    private final AuditService auditService;

    public CoachingAssignmentService(
            CoachingAssignmentRepository assignmentRepository,
            CoachingParticipantRepository participantRepository,
            CoachReplacementHistoryRepository replacementHistoryRepository,
            PmsPerformanceRecordRepository performanceRecordRepository,
            PmsGoalLineRepository goalLineRepository,
            EmployeeRepository employeeRepository,
            EmployeeQueryService employeeQueryService,
            UserRepository userRepository,
            FiscalQuarterRepository fiscalQuarterRepository,
            NotificationService notificationService,
            AuditService auditService
    ) {
        this.assignmentRepository = assignmentRepository;
        this.participantRepository = participantRepository;
        this.replacementHistoryRepository = replacementHistoryRepository;
        this.performanceRecordRepository = performanceRecordRepository;
        this.goalLineRepository = goalLineRepository;
        this.employeeRepository = employeeRepository;
        this.employeeQueryService = employeeQueryService;
        this.userRepository = userRepository;
        this.fiscalQuarterRepository = fiscalQuarterRepository;
        this.notificationService = notificationService;
        this.auditService = auditService;
    }

    // ─────────────────────────── 1. ROSTER SEARCH ───────────────────────────

    @Transactional(readOnly = true)
    public Page<CoachingAssignmentDto> searchAssignments(
            Long performanceFiscalQuarterId,
            Long coachingFiscalQuarterId,
            AssignmentPathway pathway,
            AssignmentStatus status,
            AssignmentClosureReason closureReason,
            Boolean atRisk,
            String search,
            String department,
            int page,
            int size
    ) {
        int boundedPage = Math.max(0, page);
        int boundedSize = Math.max(1, Math.min(size, 100));
        Pageable pageable = PageRequest.of(boundedPage, boundedSize, Sort.by(Sort.Direction.DESC, "createdAt", "id"));

        Specification<CoachingAssignment> spec = (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();

            if (performanceFiscalQuarterId != null) {
                predicates.add(cb.equal(root.get("performanceFiscalQuarterId"), performanceFiscalQuarterId));
            }
            if (coachingFiscalQuarterId != null) {
                predicates.add(cb.equal(root.get("coachingFiscalQuarterId"), coachingFiscalQuarterId));
            }
            if (pathway != null) {
                predicates.add(cb.equal(root.get("pathway"), pathway));
            }
            if (status != null) {
                predicates.add(cb.equal(root.get("status"), status));
            }
            if (closureReason != null) {
                predicates.add(cb.equal(root.get("closureReason"), closureReason));
            }
            if (atRisk != null) {
                predicates.add(cb.equal(root.get("atRisk"), atRisk));
            }

            // Employee search (by name or employeeNumber)
            if (search != null && !search.isBlank()) {
                String pattern = "%" + search.trim().toLowerCase() + "%";
                List<Long> matchedEmpIds = employeeRepository.findAll((empRoot, empQuery, empCb) ->
                        empCb.or(
                                empCb.like(empCb.lower(empRoot.get("employeeNumber")), pattern),
                                empCb.like(empCb.lower(empRoot.get("fullName")), pattern)
                        )
                ).stream().map(Employee::getId).toList();

                if (matchedEmpIds.isEmpty()) {
                    predicates.add(cb.disjunction());
                } else {
                    predicates.add(cb.or(
                            root.get("coacheeEmployeeId").in(matchedEmpIds),
                            root.get("coachEmployeeId").in(matchedEmpIds)
                    ));
                }
            }

            // Department filter
            if (department != null && !department.isBlank() && !department.equalsIgnoreCase("ALL")) {
                List<Long> deptEmpIds = employeeRepository.findAll((empRoot, empQuery, empCb) ->
                        empCb.equal(empRoot.get("department").get("name"), department.trim())
                ).stream().map(Employee::getId).toList();

                if (deptEmpIds.isEmpty()) {
                    predicates.add(cb.disjunction());
                } else {
                    predicates.add(root.get("coacheeEmployeeId").in(deptEmpIds));
                }
            }

            return cb.and(predicates.toArray(new Predicate[0]));
        };

        Page<CoachingAssignment> assignmentsPage = assignmentRepository.findAll(spec, pageable);
        return enrichAssignments(assignmentsPage);
    }

    // ─────────────────────────── 2. ASSIGNMENT DETAIL ───────────────────────────

    @Transactional(readOnly = true)
    public CoachingAssignmentDetailDto getAssignmentDetail(Long assignmentId, ApidUserPrincipal actor) {
        CoachingAssignment assignment = assignmentRepository.findById(assignmentId)
                .orElseThrow(() -> new ResourceNotFoundException("Coaching assignment not found"));

        // IDOR Authorization check
        boolean isAdmin = actor.getAuthorities().stream()
                .anyMatch(a -> a.getAuthority().equals("COACHING_ASSIGNMENT_VIEW_ALL"));

        if (!isAdmin) {
            EmployeeDto callerEmp = employeeQueryService.findByUserId(actor.getUserId()).orElse(null);
            if (callerEmp == null) {
                throw new AccessDeniedException("No employee profile linked to user account.");
            }
            boolean isCoachee = assignment.getCoacheeEmployeeId().equals(callerEmp.id());
            boolean isCoach = assignment.getCoachEmployeeId() != null && assignment.getCoachEmployeeId().equals(callerEmp.id());
            boolean isManager = false;
            var coacheeOpt = employeeRepository.findById(assignment.getCoacheeEmployeeId());
            if (coacheeOpt.isPresent() && coacheeOpt.get().getManager() != null) {
                isManager = coacheeOpt.get().getManager().getId().equals(callerEmp.id());
            }

            if (!isCoachee && !isCoach && !isManager) {
                throw new AccessDeniedException("You are not authorized to view this coaching assignment.");
            }
        }

        CoachingAssignmentDto summaryDto = toDtoSingle(assignment);

        // Goal lines from triggering performance record
        List<PmsGoalLineDto> goalLines = List.of();
        if (assignment.getPerformanceRecordId() != null) {
            goalLines = goalLineRepository.findAllByPerformanceRecordIdOrderBySourceRowNumberAsc(assignment.getPerformanceRecordId())
                    .stream()
                    .map(g -> new PmsGoalLineDto(
                            g.getSourceRowNumber(),
                            g.getGoalName(),
                            g.getGoalTrackingName(),
                            g.getTargetValue(),
                            g.getActualValue(),
                            g.getGoalScore(),
                            g.getWeight(),
                            g.getLineScore()
                    )).toList();
        }

        // Replacement history
        List<CoachReplacementHistory> historyEntities = replacementHistoryRepository
                .findAllByAssignmentIdOrderByChangedAtAsc(assignmentId);

        Set<Long> userIds = historyEntities.stream().map(CoachReplacementHistory::getChangedByUserId).collect(Collectors.toSet());
        Map<Long, String> usernames = userRepository.findAllById(userIds).stream()
                .collect(Collectors.toMap(User::getId, User::getUsername));

        Set<Long> empIds = new HashSet<>();
        for (CoachReplacementHistory h : historyEntities) {
            if (h.getPreviousCoachEmployeeId() != null) empIds.add(h.getPreviousCoachEmployeeId());
            if (h.getNewCoachEmployeeId() != null) empIds.add(h.getNewCoachEmployeeId());
        }
        Map<Long, EmployeeDto> empMap = employeeRepository.findAllById(empIds).stream()
                .map(emp -> EmployeeDto.from(emp, null))
                .collect(Collectors.toMap(EmployeeDto::id, e -> e));

        List<CoachReplacementHistoryDto> historyDtos = historyEntities.stream().map(h -> {
            String prevName = h.getPreviousCoachEmployeeId() != null && empMap.containsKey(h.getPreviousCoachEmployeeId())
                    ? empMap.get(h.getPreviousCoachEmployeeId()).fullName() : null;
            String newName = empMap.containsKey(h.getNewCoachEmployeeId())
                    ? empMap.get(h.getNewCoachEmployeeId()).fullName() : "Employee #" + h.getNewCoachEmployeeId();
            String username = usernames.getOrDefault(h.getChangedByUserId(), "system");

            return new CoachReplacementHistoryDto(
                    h.getId(),
                    h.getAssignmentId(),
                    h.getPreviousCoachEmployeeId(),
                    prevName,
                    h.getNewCoachEmployeeId(),
                    newName,
                    h.getReason(),
                    h.getChangedByUserId(),
                    username,
                    h.getChangedAt()
            );
        }).toList();

        // Participants
        List<CoachingParticipant> participantEntities = participantRepository
                .findAllByAssignmentIdOrderByCreatedAtAsc(assignmentId);
        Set<Long> partEmpIds = participantEntities.stream().map(CoachingParticipant::getEmployeeId).collect(Collectors.toSet());
        Map<Long, EmployeeDto> partEmpMap = employeeRepository.findAllById(partEmpIds).stream()
                .map(emp -> EmployeeDto.from(emp, null))
                .collect(Collectors.toMap(EmployeeDto::id, e -> e));

        List<CoachingParticipantDto> participantDtos = participantEntities.stream().map(p -> {
            EmployeeDto e = partEmpMap.get(p.getEmployeeId());
            return new CoachingParticipantDto(
                    p.getId(),
                    p.getAssignmentId(),
                    p.getEmployeeId(),
                    e != null ? e.employeeNumber() : null,
                    e != null ? e.fullName() : "Employee #" + p.getEmployeeId(),
                    e != null ? e.departmentName() : null,
                    p.getRole(),
                    p.isActive(),
                    p.getCreatedAt()
            );
        }).toList();

        return new CoachingAssignmentDetailDto(summaryDto, goalLines, historyDtos, participantDtos);
    }

    @Transactional(readOnly = true)
    public EmployeePerformanceGoalsDto getEmployeePerformanceGoals(Long employeeId, ApidUserPrincipal actor) {
        Employee targetEmp = employeeRepository.findById(employeeId)
                .orElseThrow(() -> new ResourceNotFoundException("Employee not found with id: " + employeeId));

        boolean isAdmin = actor.getAuthorities().stream()
                .anyMatch(a -> a.getAuthority().equals("COACHING_ASSIGNMENT_VIEW_ALL"));

        if (!isAdmin) {
            EmployeeDto callerEmp = employeeQueryService.findByUserId(actor.getUserId()).orElse(null);
            if (callerEmp == null) {
                throw new AccessDeniedException("No employee profile linked to user account.");
            }
            boolean isSelf = callerEmp.id().equals(employeeId);
            boolean isDirectManager = targetEmp.getManager() != null && targetEmp.getManager().getId().equals(callerEmp.id());
            boolean isCoach = assignmentRepository.existsByCoachEmployeeIdAndCoacheeEmployeeId(callerEmp.id(), employeeId);

            if (!isSelf && !isDirectManager && !isCoach) {
                throw new AccessDeniedException("You are not authorized to view this employee's performance goals.");
            }
        }

        // Fetch latest PMS performance record
        Optional<PmsPerformanceRecord> recordOpt = performanceRecordRepository.findFirstByEmployeeIdOrderByCreatedAtDesc(employeeId);

        List<PmsGoalLineDto> goalLines = List.of();
        BigDecimal overallFinalRating = null;
        Short roundedRating = null;
        String pmsYear = null;
        Short pmsQuarter = null;
        boolean mandatoryTriggered = false;
        String coachingQuarterLabel = null;

        if (recordOpt.isPresent()) {
            PmsPerformanceRecord record = recordOpt.get();
            overallFinalRating = record.getOverallFinalRating();
            roundedRating = record.getRoundedOverallFinalRating();
            pmsYear = record.getPmsYear();
            pmsQuarter = record.getPmsQuarter();
            mandatoryTriggered = record.isMandatoryCoachingTriggered();

            var quarterOpt = fiscalQuarterRepository.findById(record.getPerformanceFiscalQuarterId());
            if (quarterOpt.isPresent()) {
                coachingQuarterLabel = quarterOpt.get().getLabel();
            }

            goalLines = goalLineRepository.findAllByPerformanceRecordIdOrderBySourceRowNumberAsc(record.getId())
                    .stream()
                    .map(g -> new PmsGoalLineDto(
                            g.getSourceRowNumber(),
                            g.getGoalName(),
                            g.getGoalTrackingName(),
                            g.getTargetValue(),
                            g.getActualValue(),
                            g.getGoalScore(),
                            g.getWeight(),
                            g.getLineScore()
                    )).toList();
        }

        String deptName = targetEmp.getDepartment() != null ? targetEmp.getDepartment().getName() : targetEmp.getDepartmentName();
        String pos = targetEmp.getPosition() != null ? targetEmp.getPosition() : targetEmp.getJob();

        return new EmployeePerformanceGoalsDto(
                targetEmp.getId(),
                targetEmp.getEmployeeNumber(),
                targetEmp.getFullName(),
                deptName,
                pos,
                pmsYear,
                pmsQuarter,
                coachingQuarterLabel,
                overallFinalRating,
                roundedRating,
                mandatoryTriggered,
                goalLines
        );
    }

    // ─────────────────────────── 3. RESOLVE PENDING COACH ───────────────────────────

    @Transactional
    public CoachingAssignmentDto assignCoach(Long assignmentId, AssignCoachRequest request, ApidUserPrincipal actor) {
        CoachingAssignment assignment = assignmentRepository.findByIdForUpdate(assignmentId)
                .orElseThrow(() -> new ResourceNotFoundException("Coaching assignment not found"));

        if (assignment.getStatus() != AssignmentStatus.PENDING_COACH_ASSIGNMENT) {
            throw new BusinessException("INVALID_ASSIGNMENT_STATE",
                    "Assignment is not in PENDING_COACH_ASSIGNMENT status. Current status: " + assignment.getStatus(),
                    HttpStatus.CONFLICT);
        }

        EmployeeDto coach = employeeQueryService.findById(request.coachEmployeeId())
                .orElseThrow(() -> new BusinessException("COACH_NOT_FOUND", "Coach employee not found", HttpStatus.BAD_REQUEST));

        if (coach.employmentStatus() != EmploymentStatus.ACTIVE) {
            throw new BusinessException("COACH_NOT_ACTIVE", "Selected coach is not an active employee.", HttpStatus.BAD_REQUEST);
        }

        if (coach.id().equals(assignment.getCoacheeEmployeeId())) {
            throw new BusinessException("CANNOT_COACH_SELF", "An employee cannot be assigned as their own coach.", HttpStatus.BAD_REQUEST);
        }

        EmployeeDto coachee = employeeQueryService.getById(assignment.getCoacheeEmployeeId());

        // Update assignment
        assignment.setCoachEmployeeId(coach.id());
        assignment.setStatus(AssignmentStatus.ACTIVE);
        assignment.setLastActivityAt(Instant.now());
        CoachingAssignment saved = assignmentRepository.save(assignment);

        // Add Coach participant
        CoachingParticipant coachParticipant = new CoachingParticipant();
        coachParticipant.setAssignmentId(saved.getId());
        coachParticipant.setEmployeeId(coach.id());
        coachParticipant.setRole(ParticipantRole.COACH);
        coachParticipant.setActive(true);
        participantRepository.save(coachParticipant);

        // Record replacement history
        CoachReplacementHistory history = new CoachReplacementHistory();
        history.setAssignmentId(saved.getId());
        history.setPreviousCoachEmployeeId(null);
        history.setNewCoachEmployeeId(coach.id());
        history.setReason(request.reason().trim());
        history.setChangedByUserId(actor.getUserId());
        replacementHistoryRepository.save(history);

        // Audit log
        auditService.record(new AuditService.AuditCommand(
                null,
                actor.getUserId(),
                actor.getUsername(),
                coach.userId(),
                "COACHING",
                "COACH_ASSIGNED",
                "SUCCESS",
                null,
                "CoachingAssignment",
                saved.getId().toString(),
                Map.of(
                        "coacheeEmployeeNumber", coachee.employeeNumber(),
                        "coachEmployeeNumber", coach.employeeNumber(),
                        "reason", request.reason().trim()
                ),
                null, null
        ));

        // Notifications (idempotent, safe when userId == null)
        if (coach.userId() != null) {
            notificationService.notify(
                    coach.userId(),
                    NotificationModule.COACHING,
                    "COACHING_COACHEE_ASSIGNED",
                    "New Coachee Assigned",
                    "You have been assigned as Coach for " + coachee.fullName() + " for this cycle.",
                    "/coaching?view=coachees"
            );
        }
        if (coachee.userId() != null) {
            notificationService.notify(
                    coachee.userId(),
                    NotificationModule.COACHING,
                    "COACHING_COACH_ASSIGNED",
                    "Coach Assigned",
                    coach.fullName() + " has been assigned as your Coach for this quarter.",
                    "/coaching?view=plan"
            );
        }

        return toDtoSingle(saved);
    }

    // ─────────────────────────── 4. MID-QUARTER COACH REASSIGNMENT ───────────────────────────

    @Transactional
    public CoachingAssignmentDto replaceCoach(Long assignmentId, ReplaceCoachRequest request, ApidUserPrincipal actor) {
        CoachingAssignment assignment = assignmentRepository.findByIdForUpdate(assignmentId)
                .orElseThrow(() -> new ResourceNotFoundException("Coaching assignment not found"));

        if (assignment.getStatus() != AssignmentStatus.ACTIVE) {
            throw new BusinessException("INVALID_ASSIGNMENT_STATE",
                    "Only active coaching assignments can have their coach replaced. Current status: " + assignment.getStatus(),
                    HttpStatus.CONFLICT);
        }

        EmployeeDto newCoach = employeeQueryService.findById(request.newCoachEmployeeId())
                .orElseThrow(() -> new BusinessException("COACH_NOT_FOUND", "Selected coach employee not found", HttpStatus.BAD_REQUEST));

        if (newCoach.employmentStatus() != EmploymentStatus.ACTIVE) {
            throw new BusinessException("COACH_NOT_ACTIVE", "Selected coach is not an active employee.", HttpStatus.BAD_REQUEST);
        }

        if (newCoach.id().equals(assignment.getCoacheeEmployeeId())) {
            throw new BusinessException("CANNOT_COACH_SELF", "An employee cannot be assigned as their own coach.", HttpStatus.BAD_REQUEST);
        }

        if (newCoach.id().equals(assignment.getCoachEmployeeId())) {
            throw new BusinessException("ALREADY_ASSIGNED_COACH", "Selected employee is already the assigned coach for this assignment.", HttpStatus.BAD_REQUEST);
        }

        Long previousCoachId = assignment.getCoachEmployeeId();
        EmployeeDto previousCoach = previousCoachId != null ? employeeQueryService.findById(previousCoachId).orElse(null) : null;
        EmployeeDto coachee = employeeQueryService.getById(assignment.getCoacheeEmployeeId());

        // Deactivate previous Coach participant — flush immediately so the unique partial index releases
        participantRepository.findByAssignmentIdAndRoleAndActiveTrue(assignmentId, ParticipantRole.COACH)
                .ifPresent(p -> {
                    p.setActive(false);
                    p.setLeftAt(Instant.now());
                    participantRepository.saveAndFlush(p);
                });
        entityManager.flush();

        // Add new Coach participant
        CoachingParticipant newPart = new CoachingParticipant();
        newPart.setAssignmentId(assignmentId);
        newPart.setEmployeeId(newCoach.id());
        newPart.setRole(ParticipantRole.COACH);
        newPart.setActive(true);
        participantRepository.save(newPart);

        // Update assignment
        assignment.setCoachEmployeeId(newCoach.id());
        assignment.setLastActivityAt(Instant.now());
        CoachingAssignment saved = assignmentRepository.save(assignment);

        // Insert replacement history
        CoachReplacementHistory history = new CoachReplacementHistory();
        history.setAssignmentId(saved.getId());
        history.setPreviousCoachEmployeeId(previousCoachId);
        history.setNewCoachEmployeeId(newCoach.id());
        history.setReason(request.reason().trim());
        history.setChangedByUserId(actor.getUserId());
        replacementHistoryRepository.save(history);

        // Audit log
        auditService.record(new AuditService.AuditCommand(
                null,
                actor.getUserId(),
                actor.getUsername(),
                newCoach.userId(),
                "COACHING",
                "COACH_REPLACED",
                "SUCCESS",
                null,
                "CoachingAssignment",
                saved.getId().toString(),
                Map.of(
                        "coacheeEmployeeNumber", coachee.employeeNumber(),
                        "previousCoachId", previousCoachId != null ? previousCoachId : "NONE",
                        "newCoachId", newCoach.id(),
                        "reason", request.reason().trim()
                ),
                null, null
        ));

        // Notifications
        if (newCoach.userId() != null) {
            notificationService.notify(
                    newCoach.userId(),
                    NotificationModule.COACHING,
                    "COACHING_COACHEE_ASSIGNED",
                    "New Coachee Assigned",
                    "You have been assigned as the new Coach for " + coachee.fullName() + ".",
                    "/coaching?view=coachees"
            );
        }
        if (previousCoach != null && previousCoach.userId() != null) {
            notificationService.notify(
                    previousCoach.userId(),
                    NotificationModule.COACHING,
                    "COACHING_ASSIGNMENT_TRANSFERRED",
                    "Coaching Assignment Transferred",
                    "Coaching assignment for " + coachee.fullName() + " has been reassigned to " + newCoach.fullName() + ".",
                    "/coaching?view=coachees"
            );
        }
        if (coachee.userId() != null) {
            notificationService.notify(
                    coachee.userId(),
                    NotificationModule.COACHING,
                    "COACHING_COACH_REASSIGNED",
                    "Coach Reassigned",
                    "Your Coach has been changed to " + newCoach.fullName() + ".",
                    "/coaching?view=plan"
            );
        }

        return toDtoSingle(saved);
    }

    // ─────────────────────────── 5. ADMINISTRATIVE CLOSURE ───────────────────────────

    @Transactional
    public void closeAssignment(Long assignmentId, CloseAssignmentRequest request, ApidUserPrincipal actor) {
        CoachingAssignment assignment = assignmentRepository.findByIdForUpdate(assignmentId)
                .orElseThrow(() -> new ResourceNotFoundException("Coaching assignment not found"));

        if (assignment.getStatus() == AssignmentStatus.CLOSED || assignment.getStatus() == AssignmentStatus.COMPLETED) {
            throw new BusinessException("ALREADY_CLOSED",
                    "Assignment is already closed or completed. Current status: " + assignment.getStatus(),
                    HttpStatus.CONFLICT);
        }

        // Deactivate all participants
        List<CoachingParticipant> activeParts = participantRepository.findAllByAssignmentIdAndActiveTrue(assignmentId);
        for (CoachingParticipant p : activeParts) {
            p.setActive(false);
            participantRepository.save(p);
        }

        assignment.setStatus(AssignmentStatus.CLOSED);
        assignment.setClosureReason(AssignmentClosureReason.ADMINISTRATIVE_CLOSURE);
        assignment.setClosedAt(Instant.now());
        CoachingAssignment saved = assignmentRepository.save(assignment);

        EmployeeDto coachee = employeeQueryService.getById(saved.getCoacheeEmployeeId());

        auditService.record(new AuditService.AuditCommand(
                null,
                actor.getUserId(),
                actor.getUsername(),
                null,
                "COACHING",
                "ASSIGNMENT_CLOSED_ADMINISTRATIVE",
                "SUCCESS",
                null,
                "CoachingAssignment",
                saved.getId().toString(),
                Map.of(
                        "coacheeEmployeeNumber", coachee.employeeNumber(),
                        "reason", request.reason().trim()
                ),
                null, null
        ));

        // Notifications
        if (coachee.userId() != null) {
            notificationService.notify(
                    coachee.userId(),
                    NotificationModule.COACHING,
                    "COACHING_ASSIGNMENT_CLOSED",
                    "Coaching Plan Closed",
                    "Your coaching plan has been administratively closed: " + request.reason().trim(),
                    "/coaching?view=plan"
            );
        }
    }

    // ─────────────────────────── 6. PERSONAL WORKSPACE (TALENT) ───────────────────────────

    @Transactional(readOnly = true)
    public MyCoachingWorkspaceDto getMyCoaching(ApidUserPrincipal actor) {
        EmployeeDto me = employeeQueryService.findByUserId(actor.getUserId()).orElse(null);
        if (me == null) {
            return new MyCoachingWorkspaceDto(List.of());
        }

        List<CoachingAssignment> activeAssignments = assignmentRepository
                .findAllByCoacheeEmployeeIdAndStatusInOrderByCreatedAtDesc(
                        me.id(),
                        List.of(AssignmentStatus.ACTIVE, AssignmentStatus.PENDING_COACH_ASSIGNMENT)
                );

        if (activeAssignments.isEmpty()) {
            return new MyCoachingWorkspaceDto(List.of());
        }

        // Batch resolve quarter labels
        Set<Long> qIds = new HashSet<>();
        Set<Long> perfRecordIds = new HashSet<>();
        Set<Long> coachIds = new HashSet<>();

        for (CoachingAssignment a : activeAssignments) {
            qIds.add(a.getPerformanceFiscalQuarterId());
            qIds.add(a.getCoachingFiscalQuarterId());
            if (a.getPerformanceRecordId() != null) perfRecordIds.add(a.getPerformanceRecordId());
            if (a.getCoachEmployeeId() != null) coachIds.add(a.getCoachEmployeeId());
        }

        Map<Long, String> quarterLabels = fiscalQuarterRepository.findAllById(qIds).stream()
                .collect(Collectors.toMap(FiscalQuarter::getId, FiscalQuarter::getLabel));

        Map<Long, PmsPerformanceRecord> recordsMap = performanceRecordRepository.findAllById(perfRecordIds).stream()
                .collect(Collectors.toMap(PmsPerformanceRecord::getId, r -> r));

        Map<Long, EmployeeDto> coachMap = employeeRepository.findAllById(coachIds).stream()
                .map(emp -> EmployeeDto.from(emp, null))
                .collect(Collectors.toMap(EmployeeDto::id, e -> e));

        List<MyCoachingPlanDto> planDtos = new ArrayList<>();
        for (CoachingAssignment a : activeAssignments) {
            EmployeeDto coach = a.getCoachEmployeeId() != null ? coachMap.get(a.getCoachEmployeeId()) : null;
            PmsPerformanceRecord rec = a.getPerformanceRecordId() != null ? recordsMap.get(a.getPerformanceRecordId()) : null;

            List<PmsGoalLineDto> goalLines = List.of();
            if (rec != null) {
                goalLines = goalLineRepository.findAllByPerformanceRecordIdOrderBySourceRowNumberAsc(rec.getId())
                        .stream()
                        .map(g -> new PmsGoalLineDto(
                                g.getSourceRowNumber(),
                                g.getGoalName(),
                                g.getGoalTrackingName(),
                                g.getTargetValue(),
                                g.getActualValue(),
                                g.getGoalScore(),
                                g.getWeight(),
                                g.getLineScore()
                        )).toList();
            }

            planDtos.add(new MyCoachingPlanDto(
                    a.getId(),
                    a.getPathway(),
                    a.getStatus(),
                    quarterLabels.getOrDefault(a.getCoachingFiscalQuarterId(), "Quarter #" + a.getCoachingFiscalQuarterId()),
                    quarterLabels.getOrDefault(a.getPerformanceFiscalQuarterId(), "Quarter #" + a.getPerformanceFiscalQuarterId()),
                    coach != null ? coach.id() : null,
                    coach != null ? coach.employeeNumber() : null,
                    coach != null ? coach.fullName() : (a.getStatus() == AssignmentStatus.PENDING_COACH_ASSIGNMENT ? "Pending Coach Assignment" : "Unassigned"),
                    coach != null ? coach.departmentName() : null,
                    coach != null ? (coach.position() != null ? coach.position() : coach.job()) : null,
                    coach != null ? coach.email() : null,
                    rec != null ? rec.getOverallFinalRating() : null,
                    rec != null ? rec.getRoundedOverallFinalRating() : null,
                    goalLines,
                    a.isAtRisk(),
                    a.getLastActivityAt(),
                    a.getCreatedAt()
            ));
        }

        return new MyCoachingWorkspaceDto(planDtos);
    }

    // ─────────────────────────── 7. PERSONAL WORKSPACE (COACH) ───────────────────────────

    @Transactional(readOnly = true)
    public List<MyCoacheeItemDto> getMyCoachees(ApidUserPrincipal actor) {
        EmployeeDto coach = employeeQueryService.findByUserId(actor.getUserId()).orElse(null);
        if (coach == null) {
            return List.of();
        }

        List<CoachingAssignment> assignments = assignmentRepository
                .findAllByCoachEmployeeIdAndStatusInOrderByCreatedAtDesc(
                        coach.id(),
                        List.of(AssignmentStatus.ACTIVE)
                );

        if (assignments.isEmpty()) {
            return List.of();
        }

        Set<Long> coacheeIds = assignments.stream().map(CoachingAssignment::getCoacheeEmployeeId).collect(Collectors.toSet());
        Set<Long> qIds = assignments.stream().map(CoachingAssignment::getCoachingFiscalQuarterId).collect(Collectors.toSet());
        Set<Long> recordIds = assignments.stream()
                .map(CoachingAssignment::getPerformanceRecordId)
                .filter(Objects::nonNull)
                .collect(Collectors.toSet());

        Map<Long, EmployeeDto> coacheeMap = employeeRepository.findAllById(coacheeIds).stream()
                .map(emp -> EmployeeDto.from(emp, null))
                .collect(Collectors.toMap(EmployeeDto::id, e -> e));

        Map<Long, String> quarterLabels = fiscalQuarterRepository.findAllById(qIds).stream()
                .collect(Collectors.toMap(FiscalQuarter::getId, FiscalQuarter::getLabel));

        Map<Long, PmsPerformanceRecord> recordsMap = performanceRecordRepository.findAllById(recordIds).stream()
                .collect(Collectors.toMap(PmsPerformanceRecord::getId, r -> r));

        return assignments.stream().map(a -> {
            EmployeeDto coachee = coacheeMap.get(a.getCoacheeEmployeeId());
            PmsPerformanceRecord rec = a.getPerformanceRecordId() != null ? recordsMap.get(a.getPerformanceRecordId()) : null;
            int goalCount = 0;
            if (rec != null) {
                goalCount = goalLineRepository.findAllByPerformanceRecordIdOrderBySourceRowNumberAsc(rec.getId()).size();
            }

            return new MyCoacheeItemDto(
                    a.getId(),
                    a.getCoacheeEmployeeId(),
                    coachee != null ? coachee.employeeNumber() : null,
                    coachee != null ? coachee.fullName() : "Employee #" + a.getCoacheeEmployeeId(),
                    coachee != null ? coachee.departmentName() : null,
                    coachee != null ? (coachee.position() != null ? coachee.position() : coachee.job()) : null,
                    coachee != null ? coachee.email() : null,
                    a.getPathway(),
                    a.getStatus(),
                    a.isAtRisk(),
                    rec != null ? rec.getOverallFinalRating() : null,
                    rec != null ? rec.getRoundedOverallFinalRating() : null,
                    quarterLabels.getOrDefault(a.getCoachingFiscalQuarterId(), "Quarter #" + a.getCoachingFiscalQuarterId()),
                    goalCount,
                    a.getLastActivityAt(),
                    a.getCreatedAt()
            );
        }).toList();
    }

    // ─────────────────────────── HELPERS ───────────────────────────

    private Page<CoachingAssignmentDto> enrichAssignments(Page<CoachingAssignment> page) {
        if (page.isEmpty()) {
            return page.map(a -> null);
        }

        Set<Long> empIds = new HashSet<>();
        Set<Long> qIds = new HashSet<>();
        Set<Long> perfRecordIds = new HashSet<>();

        for (CoachingAssignment a : page.getContent()) {
            empIds.add(a.getCoacheeEmployeeId());
            if (a.getCoachEmployeeId() != null) empIds.add(a.getCoachEmployeeId());
            qIds.add(a.getPerformanceFiscalQuarterId());
            qIds.add(a.getCoachingFiscalQuarterId());
            if (a.getPerformanceRecordId() != null) perfRecordIds.add(a.getPerformanceRecordId());
        }

        Map<Long, EmployeeDto> empMap = employeeRepository.findAllById(empIds).stream()
                .map(emp -> EmployeeDto.from(emp, null))
                .collect(Collectors.toMap(EmployeeDto::id, e -> e));

        Map<Long, String> quarterLabels = fiscalQuarterRepository.findAllById(qIds).stream()
                .collect(Collectors.toMap(FiscalQuarter::getId, FiscalQuarter::getLabel));

        Map<Long, PmsPerformanceRecord> recordsMap = performanceRecordRepository.findAllById(perfRecordIds).stream()
                .collect(Collectors.toMap(PmsPerformanceRecord::getId, r -> r));

        return page.map(a -> {
            EmployeeDto coachee = empMap.get(a.getCoacheeEmployeeId());
            EmployeeDto coach = a.getCoachEmployeeId() != null ? empMap.get(a.getCoachEmployeeId()) : null;
            PmsPerformanceRecord rec = a.getPerformanceRecordId() != null ? recordsMap.get(a.getPerformanceRecordId()) : null;

            return new CoachingAssignmentDto(
                    a.getId(),
                    a.getPathway(),
                    a.getStatus(),
                    a.getClosureReason(),
                    a.isAtRisk(),
                    a.getMissedSessionsCount(),
                    a.getCoacheeEmployeeId(),
                    coachee != null ? coachee.employeeNumber() : null,
                    coachee != null ? coachee.fullName() : "Employee #" + a.getCoacheeEmployeeId(),
                    coachee != null ? coachee.departmentName() : null,
                    coachee != null ? (coachee.position() != null ? coachee.position() : coachee.job()) : null,
                    a.getCoachEmployeeId(),
                    coach != null ? coach.employeeNumber() : null,
                    coach != null ? coach.fullName() : (a.getStatus() == AssignmentStatus.PENDING_COACH_ASSIGNMENT ? "Pending Coach Assignment" : null),
                    coach != null ? coach.departmentName() : null,
                    a.getPerformanceRecordId(),
                    rec != null ? rec.getOverallFinalRating() : null,
                    rec != null ? rec.getRoundedOverallFinalRating() : null,
                    a.getPerformanceFiscalQuarterId(),
                    quarterLabels.getOrDefault(a.getPerformanceFiscalQuarterId(), "Q" + a.getPerformanceFiscalQuarterId()),
                    a.getCoachingFiscalQuarterId(),
                    quarterLabels.getOrDefault(a.getCoachingFiscalQuarterId(), "Q" + a.getCoachingFiscalQuarterId()),
                    a.getLastActivityAt(),
                    a.getClosedAt(),
                    a.getCreatedAt()
            );
        });
    }

    private CoachingAssignmentDto toDtoSingle(CoachingAssignment a) {
        EmployeeDto coachee = employeeQueryService.findById(a.getCoacheeEmployeeId()).orElse(null);
        EmployeeDto coach = a.getCoachEmployeeId() != null ? employeeQueryService.findById(a.getCoachEmployeeId()).orElse(null) : null;
        PmsPerformanceRecord rec = a.getPerformanceRecordId() != null
                ? performanceRecordRepository.findById(a.getPerformanceRecordId()).orElse(null) : null;

        String perfQLabel = fiscalQuarterRepository.findById(a.getPerformanceFiscalQuarterId())
                .map(FiscalQuarter::getLabel).orElse("Q" + a.getPerformanceFiscalQuarterId());
        String coachQLabel = fiscalQuarterRepository.findById(a.getCoachingFiscalQuarterId())
                .map(FiscalQuarter::getLabel).orElse("Q" + a.getCoachingFiscalQuarterId());

        return new CoachingAssignmentDto(
                a.getId(),
                a.getPathway(),
                a.getStatus(),
                a.getClosureReason(),
                a.isAtRisk(),
                a.getMissedSessionsCount(),
                a.getCoacheeEmployeeId(),
                coachee != null ? coachee.employeeNumber() : null,
                coachee != null ? coachee.fullName() : "Employee #" + a.getCoacheeEmployeeId(),
                coachee != null ? coachee.departmentName() : null,
                coachee != null ? (coachee.position() != null ? coachee.position() : coachee.job()) : null,
                a.getCoachEmployeeId(),
                coach != null ? coach.employeeNumber() : null,
                coach != null ? coach.fullName() : (a.getStatus() == AssignmentStatus.PENDING_COACH_ASSIGNMENT ? "Pending Coach Assignment" : null),
                coach != null ? coach.departmentName() : null,
                a.getPerformanceRecordId(),
                rec != null ? rec.getOverallFinalRating() : null,
                rec != null ? rec.getRoundedOverallFinalRating() : null,
                a.getPerformanceFiscalQuarterId(),
                perfQLabel,
                a.getCoachingFiscalQuarterId(),
                coachQLabel,
                a.getLastActivityAt(),
                a.getClosedAt(),
                a.getCreatedAt()
        );
    }
}
