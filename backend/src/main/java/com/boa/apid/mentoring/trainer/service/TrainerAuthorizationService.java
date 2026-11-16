package com.boa.apid.mentoring.trainer.service;

import com.boa.apid.common.exception.BusinessException;
import com.boa.apid.common.exception.ResourceNotFoundException;
import com.boa.apid.core.audit.service.AuditService;
import com.boa.apid.core.auth.security.ApidUserPrincipal;
import com.boa.apid.core.authorization.entity.Role;
import com.boa.apid.core.authorization.entity.User;
import com.boa.apid.core.authorization.entity.UserRole;
import com.boa.apid.core.authorization.entity.UserStatus;
import com.boa.apid.core.authorization.repository.RoleRepository;
import com.boa.apid.core.authorization.repository.UserRepository;
import com.boa.apid.core.authorization.repository.UserRoleRepository;
import com.boa.apid.core.authorization.service.PermissionCacheInvalidationEvent;
import com.boa.apid.core.config.service.CoreConfigService;
import com.boa.apid.core.notifications.entity.NotificationModule;
import com.boa.apid.core.notifications.service.NotificationService;
import com.boa.apid.core.organization.entity.Employee;
import com.boa.apid.core.organization.entity.EmploymentStatus;
import com.boa.apid.core.organization.repository.EmployeeRepository;
import com.boa.apid.core.skills.entity.Skill;
import com.boa.apid.core.skills.repository.SkillRepository;
import com.boa.apid.mentoring.application.entity.MentorApplication;
import com.boa.apid.mentoring.application.entity.MentorApplicationStatus;
import com.boa.apid.mentoring.application.repository.MentorApplicationRepository;
import com.boa.apid.mentoring.collaboration.repository.MentoringRelationshipFeedbackRepository;
import com.boa.apid.mentoring.matching.entity.MentoringMatchRequestStatus;
import com.boa.apid.mentoring.matching.repository.MentoringMatchRequestRepository;
import com.boa.apid.mentoring.pairing.entity.MentoringRelationship;
import com.boa.apid.mentoring.pairing.entity.MentoringRelationshipStatus;
import com.boa.apid.mentoring.pairing.entity.MentoringRequestRecipientStatus;
import com.boa.apid.mentoring.pairing.repository.MentoringRelationshipMemberRepository;
import com.boa.apid.mentoring.pairing.repository.MentoringRelationshipRepository;
import com.boa.apid.mentoring.pairing.repository.MentoringRequestRecipientRepository;
import com.boa.apid.mentoring.pairing.repository.MentoringSessionRepository;
import com.boa.apid.mentoring.pairing.entity.MentoringSessionStatus;
import com.boa.apid.mentoring.trainer.dto.MentoringHrOverviewDto;
import com.boa.apid.mentoring.trainer.dto.MentoringSkillDemandDto;
import com.boa.apid.mentoring.trainer.dto.TrainerAppointmentRequest;
import com.boa.apid.mentoring.trainer.dto.TrainerDirectoryDto;
import com.boa.apid.mentoring.trainer.dto.TrainerEmployeeCandidateDto;
import com.boa.apid.mentoring.trainer.dto.TrainerProfileRequest;
import com.boa.apid.mentoring.trainer.dto.TrainerRosterDto;
import com.boa.apid.mentoring.trainer.dto.TrainerSkillDto;
import com.boa.apid.mentoring.trainer.dto.TrainerStatusRequest;
import com.boa.apid.mentoring.trainer.entity.TrainerAuthorization;
import com.boa.apid.mentoring.trainer.entity.TrainerAuthorizationSource;
import com.boa.apid.mentoring.trainer.entity.TrainerAuthorizationStatus;
import com.boa.apid.mentoring.trainer.entity.TrainerStatusHistory;
import com.boa.apid.mentoring.trainer.repository.TrainerAuthorizationRepository;
import com.boa.apid.mentoring.trainer.repository.TrainerStatusHistoryRepository;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

@Service
public class TrainerAuthorizationService {

    private static final List<TrainerAuthorizationStatus> LIVE_STATUSES =
            List.of(TrainerAuthorizationStatus.ACTIVE, TrainerAuthorizationStatus.SUSPENDED);

    private final TrainerAuthorizationRepository authorizationRepository;
    private final TrainerStatusHistoryRepository historyRepository;
    private final MentorApplicationRepository applicationRepository;
    private final EmployeeRepository employeeRepository;
    private final UserRepository userRepository;
    private final RoleRepository roleRepository;
    private final UserRoleRepository userRoleRepository;
    private final SkillRepository skillRepository;
    private final MentoringRelationshipRepository relationshipRepository;
    private final MentoringRelationshipMemberRepository memberRepository;
    private final MentoringRequestRecipientRepository recipientRepository;
    private final MentoringSessionRepository sessionRepository;
    private final MentoringRelationshipFeedbackRepository feedbackRepository;
    private final MentoringMatchRequestRepository matchRequestRepository;
    private final CoreConfigService configService;
    private final NotificationService notificationService;
    private final AuditService auditService;
    private final ApplicationEventPublisher eventPublisher;

    public TrainerAuthorizationService(
            TrainerAuthorizationRepository authorizationRepository,
            TrainerStatusHistoryRepository historyRepository,
            MentorApplicationRepository applicationRepository,
            EmployeeRepository employeeRepository,
            UserRepository userRepository,
            RoleRepository roleRepository,
            UserRoleRepository userRoleRepository,
            SkillRepository skillRepository,
            MentoringRelationshipRepository relationshipRepository,
            MentoringRelationshipMemberRepository memberRepository,
            MentoringRequestRecipientRepository recipientRepository,
            MentoringSessionRepository sessionRepository,
            MentoringRelationshipFeedbackRepository feedbackRepository,
            MentoringMatchRequestRepository matchRequestRepository,
            CoreConfigService configService,
            NotificationService notificationService,
            AuditService auditService,
            ApplicationEventPublisher eventPublisher
    ) {
        this.authorizationRepository = authorizationRepository;
        this.historyRepository = historyRepository;
        this.applicationRepository = applicationRepository;
        this.employeeRepository = employeeRepository;
        this.userRepository = userRepository;
        this.roleRepository = roleRepository;
        this.userRoleRepository = userRoleRepository;
        this.skillRepository = skillRepository;
        this.relationshipRepository = relationshipRepository;
        this.memberRepository = memberRepository;
        this.recipientRepository = recipientRepository;
        this.sessionRepository = sessionRepository;
        this.feedbackRepository = feedbackRepository;
        this.matchRequestRepository = matchRequestRepository;
        this.configService = configService;
        this.notificationService = notificationService;
        this.auditService = auditService;
        this.eventPublisher = eventPublisher;
    }

    @Transactional(readOnly = true)
    public List<TrainerRosterDto> listRoster() {
        Map<Long, TrainerAuthorization> latestByEmployee = new LinkedHashMap<>();
        for (TrainerAuthorization authorization : authorizationRepository.findAllByOrderByUpdatedAtDescIdDesc()) {
            latestByEmployee.putIfAbsent(authorization.getEmployee().getId(), authorization);
        }
        return latestByEmployee.values().stream().map(this::toRosterDto).toList();
    }

    @Transactional(readOnly = true)
    public List<TrainerDirectoryDto> listDirectory(Long skillId, String department) {
        String normalizedDepartment = department == null || department.isBlank()
                ? null
                : department.trim().toLowerCase();
        List<TrainerAuthorization> eligible = authorizationRepository.findAllByOrderByUpdatedAtDescIdDesc().stream()
                .filter(authorization -> authorization.getStatus() == TrainerAuthorizationStatus.ACTIVE)
                .filter(authorization -> authorization.getEmployee().getEmploymentStatus() == EmploymentStatus.ACTIVE)
                .filter(authorization -> authorization.getEmployee().getUserId() != null)
                .filter(authorization -> normalizedDepartment == null
                        || (authorization.getEmployee().getDepartmentName() != null
                        && authorization.getEmployee().getDepartmentName().toLowerCase().contains(normalizedDepartment)))
                .filter(authorization -> skillId == null || authorization.getSkills().stream()
                        .anyMatch(skill -> skill.getId().equals(skillId) && skill.isActive()))
                .toList();
        Set<Long> activeUserIds = userRepository.findAllById(
                        eligible.stream().map(authorization -> authorization.getEmployee().getUserId()).toList())
                .stream()
                .filter(user -> user.getStatus() == UserStatus.ACTIVE)
                .map(User::getId)
                .collect(java.util.stream.Collectors.toSet());
        return eligible.stream()
                .filter(authorization -> activeUserIds.contains(authorization.getEmployee().getUserId()))
                .map(this::toDirectoryDto)
                .sorted(Comparator
                        .comparing((TrainerDirectoryDto trainer) -> skillId != null
                                && trainer.skills().stream().anyMatch(skill -> skill.id().equals(skillId)))
                        .reversed()
                        .thenComparing(Comparator.comparingInt(TrainerDirectoryDto::remainingCapacity).reversed())
                        .thenComparingInt(TrainerDirectoryDto::activeTrainees)
                        .thenComparing(Comparator.comparingDouble(TrainerDirectoryDto::averageRating).reversed())
                        .thenComparing(TrainerDirectoryDto::fullName, String.CASE_INSENSITIVE_ORDER))
                .toList();
    }

    @Transactional(readOnly = true)
    public List<TrainerEmployeeCandidateDto> listAppointmentCandidates() {
        List<Employee> employees = employeeRepository.findAllWithDetails().stream()
                .filter(employee -> employee.getEmploymentStatus() == EmploymentStatus.ACTIVE)
                .filter(employee -> employee.getUserId() != null)
                .toList();
        Set<Long> userIds = employees.stream().map(Employee::getUserId)
                .collect(java.util.stream.Collectors.toSet());
        Map<Long, User> activeUsers = new LinkedHashMap<>();
        userRepository.findAllById(userIds).stream()
                .filter(user -> user.getStatus() == UserStatus.ACTIVE)
                .forEach(user -> activeUsers.put(user.getId(), user));

        return employees.stream()
                .filter(employee -> activeUsers.containsKey(employee.getUserId()))
                .filter(employee -> !authorizationRepository.existsByEmployeeAndStatuses(
                        employee.getId(), LIVE_STATUSES))
                .map(employee -> new TrainerEmployeeCandidateDto(
                        employee.getId(),
                        employee.getUserId(),
                        employee.getEmployeeNumber(),
                        employee.getFullName(),
                        employee.getDepartmentName()
                ))
                .sorted(Comparator.comparing(TrainerEmployeeCandidateDto::fullName, String.CASE_INSENSITIVE_ORDER))
                .toList();
    }

    @Transactional
    public TrainerRosterDto appoint(TrainerAppointmentRequest request, ApidUserPrincipal actor) {
        List<Long> skillIds = new ArrayList<>(new LinkedHashSet<>(request.skillIds()));
        if (skillIds.size() != request.skillIds().size()) {
            throw new BusinessException("DUPLICATE_TRAINER_SKILL", "Choose each trainer skill only once.");
        }
        Employee employee = employeeRepository.findDetailedById(request.employeeId())
                .orElseThrow(() -> new ResourceNotFoundException("Employee not found"));
        if (employee.getUserId() == null || employee.getEmploymentStatus() != EmploymentStatus.ACTIVE) {
            throw new BusinessException(
                    "INACTIVE_TRAINER_CANDIDATE",
                    "Only an active, linked employee can be appointed as a trainer.",
                    HttpStatus.CONFLICT
            );
        }
        if (request.appointmentReason().isBlank()) {
            throw new BusinessException("APPOINTMENT_REASON_REQUIRED", "Enter an appointment reason.");
        }
        if (authorizationRepository.existsByEmployeeAndStatuses(employee.getId(), LIVE_STATUSES)) {
            throw new BusinessException(
                    "TRAINER_ALREADY_AUTHORIZED",
                    "This employee already has a current trainer authorization.",
                    HttpStatus.CONFLICT
            );
        }
        User trainer = userRepository.findByIdForUpdate(employee.getUserId())
                .filter(user -> user.getStatus() == UserStatus.ACTIVE)
                .orElseThrow(() -> new BusinessException(
                        "INACTIVE_TRAINER_CANDIDATE",
                        "Only an active account can be appointed as a trainer.",
                        HttpStatus.CONFLICT
                ));
        List<Skill> skills = resolveActiveSkills(skillIds);
        User appointingAdmin = userRepository.findById(actor.getUserId())
                .orElseThrow(() -> new ResourceNotFoundException("HR account not found"));
        assignMentorRole(trainer, appointingAdmin);

        TrainerAuthorization authorization = new TrainerAuthorization();
        authorization.setEmployee(employee);
        authorization.setSourceType(TrainerAuthorizationSource.DIRECT_APPOINTMENT);
        authorization.setStatus(TrainerAuthorizationStatus.ACTIVE);
        authorization.setMaxConcurrentTrainees(request.maxConcurrentTrainees());
        authorization.setAppointmentReason(request.appointmentReason().trim());
        authorization.setAuthorizedBy(appointingAdmin);
        authorization.setSkills(new LinkedHashSet<>(skills));
        TrainerAuthorization saved = authorizationRepository.save(authorization);
        saveStatusHistory(saved, null, TrainerAuthorizationStatus.ACTIVE, request.appointmentReason().trim(), appointingAdmin);
        notify(trainer.getId(), "TRAINER_DIRECTLY_APPOINTED", "You have been appointed as a mentor",
                "HR appointed you to mentor employees. Set your mentoring profile and availability.",
                "/mentoring?view=trainer");
        recordAudit(actor, trainer.getId(), "TRAINER_DIRECT_APPOINTED", saved.getId(),
                Map.of("skillIds", skillIds, "maxConcurrentTrainees", saved.getMaxConcurrentTrainees()));
        return toRosterDto(saved);
    }

    @Transactional
    public TrainerRosterDto changeStatus(Long authorizationId, TrainerStatusRequest request, ApidUserPrincipal actor) {
        TrainerAuthorization authorization = authorizationRepository.findByIdForUpdate(authorizationId)
                .orElseThrow(() -> new ResourceNotFoundException("Trainer authorization not found"));
        TrainerAuthorizationStatus previous = authorization.getStatus();
        TrainerAuthorizationStatus next = request.status();
        validateStatusTransition(previous, next);
        String reason = request.reason().trim();

        if (next != TrainerAuthorizationStatus.ACTIVE) {
            cancelPendingRequests(authorization.getEmployee().getUserId());
            if (request.inFlightPolicy() != TrainerInFlightPolicy.BLOCK_NEW_SESSIONS_ONLY) {
                pauseActiveRelationships(authorization.getEmployee().getUserId());
            }
        }

        authorization.setStatus(next);
        authorization.setStatusReason(reason);
        TrainerAuthorization saved = authorizationRepository.save(authorization);
        User actorUser = userRepository.findById(actor.getUserId())
                .orElseThrow(() -> new ResourceNotFoundException("HR account not found"));
        saveStatusHistory(saved, previous, next, reason, actorUser);
        notify(authorization.getEmployee().getUserId(), "TRAINER_STATUS_" + next.name(),
                "Mentor authorization " + next.name().toLowerCase(),
                "Your mentor authorization is now " + next.name().toLowerCase() + ". Reason: " + reason,
                "/mentoring?view=trainer");
        recordAudit(actor, authorization.getEmployee().getUserId(), "TRAINER_STATUS_" + next.name(),
                saved.getId(), Map.of("previousStatus", previous.name(), "newStatus", next.name(),
                        "reason", reason,
                        "inFlightPolicy", request.inFlightPolicy() == null ? "" : request.inFlightPolicy().name()));
        return toRosterDto(saved);
    }

    @Transactional
    public TrainerRosterDto updateOwnProfile(TrainerProfileRequest request, ApidUserPrincipal actor) {
        TrainerAuthorization authorization = authorizationRepository.findByUserIdAndStatus(
                        actor.getUserId(), TrainerAuthorizationStatus.ACTIVE)
                .stream().findFirst()
                .orElseThrow(() -> new AccessDeniedException("Only an active mentor can update this profile."));
        if (request.maxConcurrentTrainees() != null) {
            long committedCapacity = relationshipRepository.countActiveTraineesByMentorUserId(
                    actor.getUserId(), MentoringRelationshipStatus.ACTIVE)
                    + recipientRepository.countByMentorAndStatus(
                            actor.getUserId(), MentoringRequestRecipientStatus.PENDING);
            if (request.maxConcurrentTrainees() < committedCapacity) {
                throw new BusinessException(
                        "TRAINER_CAPACITY_BELOW_COMMITMENTS",
                        "Trainer capacity cannot be lower than active trainees plus pending requests.",
                        HttpStatus.CONFLICT
                );
            }
            authorization.setMaxConcurrentTrainees(request.maxConcurrentTrainees());
        }
        authorization.setBio(normalizeOptional(request.bio()));
        authorization.setAvailabilityNotes(normalizeOptional(request.availabilityNotes()));
        return toRosterDto(authorizationRepository.save(authorization));
    }

    @Transactional(readOnly = true)
    public TrainerRosterDto getOwnProfile(ApidUserPrincipal actor) {
        TrainerAuthorization authorization = authorizationRepository.findByUserIdAndStatus(
                        actor.getUserId(), TrainerAuthorizationStatus.ACTIVE)
                .stream().findFirst()
                .orElseThrow(() -> new AccessDeniedException("Only an active mentor can view this profile."));
        return toRosterDto(authorization);
    }

    @Transactional
    public TrainerAuthorization authorizeApplication(MentorApplication application, User reviewer) {
        Employee employee = employeeRepository.findDetailedByUserId(application.getApplicant().getId())
                .filter(candidate -> candidate.getEmploymentStatus() == EmploymentStatus.ACTIVE)
                .orElseThrow(() -> new BusinessException(
                        "ACTIVE_EMPLOYEE_PROFILE_REQUIRED",
                        "A mentor applicant must have an active employee profile before approval.",
                        HttpStatus.CONFLICT
                ));
        TrainerAuthorization authorization = new TrainerAuthorization();
        authorization.setEmployee(employee);
        authorization.setSourceType(TrainerAuthorizationSource.APPLICATION);
        authorization.setSourceApplication(application);
        authorization.setStatus(TrainerAuthorizationStatus.ACTIVE);
        authorization.setMaxConcurrentTrainees(application.getMaxConcurrentTrainees() == null
                ? configService.getDefaultMaxTraineesPerTrainer()
                : application.getMaxConcurrentTrainees());
        authorization.setBio(application.getExpertiseSummary());
        authorization.setAvailabilityNotes(application.getAvailabilityNotes());
        authorization.setAuthorizedBy(reviewer);
        Set<Skill> applicationSkills = application.getCatalogSkills().isEmpty()
                ? (application.getCatalogSkill() == null ? Set.of() : Set.of(application.getCatalogSkill()))
                : application.getCatalogSkills();
        authorization.setSkills(new LinkedHashSet<>(applicationSkills));
        return authorizationRepository.save(authorization);
    }

    @Transactional(readOnly = true)
    public MentoringHrOverviewDto getOverview() {
        List<TrainerAuthorization> authorizations = authorizationRepository.findAllByOrderByUpdatedAtDescIdDesc();
        Map<Long, TrainerAuthorization> latestByEmployee = new LinkedHashMap<>();
        authorizations.forEach(authorization ->
                latestByEmployee.putIfAbsent(authorization.getEmployee().getId(), authorization));
        List<TrainerAuthorization> current = new ArrayList<>(latestByEmployee.values());

        List<MentoringSkillDemandDto> supply = skillRepository.findAllByActiveTrueOrderByNameAsc().stream()
                .map(skill -> {
                    long trainers = current.stream()
                            .filter(auth -> auth.getStatus() == TrainerAuthorizationStatus.ACTIVE)
                            .filter(auth -> auth.getSkills().stream().anyMatch(candidate -> candidate.getId().equals(skill.getId())))
                            .count();
                    long slots = current.stream()
                            .filter(auth -> auth.getStatus() == TrainerAuthorizationStatus.ACTIVE)
                            .filter(auth -> auth.getSkills().stream().anyMatch(candidate -> candidate.getId().equals(skill.getId())))
                            .mapToLong(auth -> Math.max(0,
                                    auth.getMaxConcurrentTrainees()
                                            - (int) relationshipRepository.countActiveTraineesByMentorUserId(
                                            auth.getEmployee().getUserId(), MentoringRelationshipStatus.ACTIVE)
                                            - (int) recipientRepository.countByMentorAndStatus(
                                            auth.getEmployee().getUserId(), MentoringRequestRecipientStatus.PENDING)))
                            .sum();
                    return new MentoringSkillDemandDto(
                            skill.getId(),
                            skill.getName(),
                            trainers,
                            matchRequestRepository.countBySkill_IdAndStatus(skill.getId(), MentoringMatchRequestStatus.OPEN),
                            slots
                    );
                })
                .toList();

        long sessionCount = sessionRepository.count();
        long completedSessions = sessionRepository.countByStatus(MentoringSessionStatus.COMPLETED);
        long completedRelationships = relationshipRepository.countByStatus(MentoringRelationshipStatus.COMPLETED);
        long totalRelationships = relationshipRepository.count();
        Double averageFeedback = feedbackRepository.averageRating();
        return new MentoringHrOverviewDto(
                applicationRepository.countByStatus(MentorApplicationStatus.PENDING),
                applicationRepository.countByStatus(MentorApplicationStatus.APPROVED),
                applicationRepository.countByStatus(MentorApplicationStatus.DECLINED),
                current.stream().filter(auth -> auth.getStatus() == TrainerAuthorizationStatus.ACTIVE).count(),
                current.stream().filter(auth -> auth.getStatus() == TrainerAuthorizationStatus.SUSPENDED).count(),
                current.stream().filter(auth -> auth.getStatus() == TrainerAuthorizationStatus.REVOKED).count(),
                relationshipRepository.countByStatus(MentoringRelationshipStatus.ACTIVE),
                completedRelationships,
                sessionCount,
                completedSessions,
                averageFeedback == null ? 0 : averageFeedback,
                totalRelationships == 0 ? 0
                        : Math.round(completedRelationships * 1000.0 / totalRelationships) / 10.0,
                supply
        );
    }

    private void validateStatusTransition(TrainerAuthorizationStatus previous, TrainerAuthorizationStatus next) {
        if (previous == next) {
            throw new BusinessException("TRAINER_STATUS_UNCHANGED", "Choose a different trainer status.");
        }
        if (previous == TrainerAuthorizationStatus.REVOKED) {
            throw new BusinessException(
                    "TRAINER_AUTHORIZATION_REVOKED",
                    "A revoked trainer cannot be restored; the employee must be reappointed.",
                    HttpStatus.CONFLICT
            );
        }
        if (previous != TrainerAuthorizationStatus.ACTIVE && next != TrainerAuthorizationStatus.ACTIVE) {
            throw new BusinessException("INVALID_TRAINER_STATUS_TRANSITION", "Restore the trainer before changing status again.");
        }
    }

    private void cancelPendingRequests(Long mentorUserId) {
        if (mentorUserId == null) {
            return;
        }
        List<com.boa.apid.mentoring.pairing.entity.MentoringRequestRecipient> pending =
                recipientRepository.findByRequest_MentorUser_IdAndStatus(
                        mentorUserId, MentoringRequestRecipientStatus.PENDING);
        for (var recipient : pending) {
            recipient.setStatus(MentoringRequestRecipientStatus.CANCELLED);
            recipient.setRespondedAt(Instant.now());
            notificationService.notify(
                    recipient.getRequest().getInitiatedByUser().getId(),
                    NotificationModule.MENTORING,
                    "MENTORING_REQUEST_CANCELLED",
                    "Mentoring request cancelled",
                    "A pending mentoring request was cancelled because the mentor's authorization changed.",
                    "/mentoring?view=trainee"
            );
        }
        recipientRepository.saveAll(pending);
    }

    private void pauseActiveRelationships(Long mentorUserId) {
        if (mentorUserId == null) {
            return;
        }
        List<MentoringRelationship> relationships = relationshipRepository.findByMentorUser_IdAndStatus(
                mentorUserId, MentoringRelationshipStatus.ACTIVE);
        for (MentoringRelationship relationship : relationships) {
            relationship.setStatus(MentoringRelationshipStatus.PAUSED);
            memberRepository.findByRelationship_IdOrderByJoinedAtAsc(relationship.getId()).stream()
                    .filter(member -> member.getStatus()
                            == com.boa.apid.mentoring.pairing.entity.MentoringRelationshipMemberStatus.ACTIVE)
                    .forEach(member -> notify(
                            member.getTraineeUser().getId(),
                            "MENTORING_RELATIONSHIP_PAUSED",
                            "Mentoring relationship paused",
                            "Your mentoring relationship has been paused while HR reviews the mentor's authorization.",
                            "/mentoring/pairing/" + relationship.getId()
                    ));
        }
        relationshipRepository.saveAll(relationships);
    }

    private void assignMentorRole(User trainer, User appointingAdmin) {
        Role mentorRole = roleRepository.findByNameIgnoreCase("Mentor")
                .filter(Role::isActive)
                .orElseThrow(() -> new BusinessException(
                        "MENTOR_ROLE_NOT_CONFIGURED",
                        "The active Mentor role is not configured.",
                        HttpStatus.INTERNAL_SERVER_ERROR
                ));
        boolean alreadyMentor = userRoleRepository.findActiveByUserIdWithRole(trainer.getId()).stream()
                .anyMatch(userRole -> userRole.getRole().getId().equals(mentorRole.getId()));
        if (!alreadyMentor) {
            UserRole userRole = new UserRole();
            userRole.setUser(trainer);
            userRole.setRole(mentorRole);
            userRole.setAssignedBy(appointingAdmin);
            userRole.setActive(true);
            userRoleRepository.save(userRole);
            eventPublisher.publishEvent(PermissionCacheInvalidationEvent.forUser(trainer.getId()));
        }
    }

    private List<Skill> resolveActiveSkills(List<Long> skillIds) {
        List<Skill> skills = skillRepository.findAllById(skillIds).stream()
                .filter(Skill::isActive)
                .toList();
        if (skills.size() != skillIds.size()) {
            throw new ResourceNotFoundException("One or more selected skills are not active.");
        }
        return skills;
    }

    private TrainerRosterDto toRosterDto(TrainerAuthorization authorization) {
        Employee employee = authorization.getEmployee();
        Long userId = employee.getUserId();
        int active = userId == null ? 0 : (int) relationshipRepository.countActiveTraineesByMentorUserId(
                userId, MentoringRelationshipStatus.ACTIVE);
        int pending = userId == null ? 0 : (int) recipientRepository.countByMentorAndStatus(
                userId, MentoringRequestRecipientStatus.PENDING);
        return new TrainerRosterDto(
                authorization.getId(),
                employee.getId(),
                userId,
                employee.getEmployeeNumber(),
                employee.getFullName(),
                employee.getDepartmentName(),
                employee.getEmploymentStatus().name(),
                authorization.getSourceType(),
                authorization.getStatus(),
                active,
                pending,
                authorization.getMaxConcurrentTrainees(),
                authorization.getBio(),
                authorization.getAvailabilityNotes(),
                skills(authorization),
                authorization.getEffectiveFrom(),
                authorization.getUpdatedAt()
        );
    }

    private TrainerDirectoryDto toDirectoryDto(TrainerAuthorization authorization) {
        Employee employee = authorization.getEmployee();
        User user = userRepository.findById(employee.getUserId())
                .orElseThrow(() -> new ResourceNotFoundException("Mentor account not found"));
        int active = (int) relationshipRepository.countActiveTraineesByMentorUserId(
                user.getId(), MentoringRelationshipStatus.ACTIVE);
        int pending = (int) recipientRepository.countByMentorAndStatus(
                user.getId(), MentoringRequestRecipientStatus.PENDING);
        Double averageRating = feedbackRepository.averageRatingByMentorUserId(user.getId());
        return new TrainerDirectoryDto(
                user.getId(),
                user.getUsername(),
                employee.getEmployeeNumber(),
                employee.getFullName(),
                employee.getDepartmentName(),
                authorization.getBio(),
                authorization.getAvailabilityNotes(),
                active,
                Math.max(0, authorization.getMaxConcurrentTrainees() - active - pending),
                averageRating == null ? 0 : averageRating,
                skills(authorization)
        );
    }

    private List<TrainerSkillDto> skills(TrainerAuthorization authorization) {
        return authorization.getSkills().stream()
                .filter(Skill::isActive)
                .sorted(Comparator.comparing(Skill::getName, String.CASE_INSENSITIVE_ORDER))
                .map(skill -> new TrainerSkillDto(skill.getId(), skill.getName(), skill.getCategory()))
                .toList();
    }

    private void saveStatusHistory(
            TrainerAuthorization authorization,
            TrainerAuthorizationStatus previous,
            TrainerAuthorizationStatus next,
            String reason,
            User changedBy
    ) {
        TrainerStatusHistory history = new TrainerStatusHistory();
        history.setAuthorization(authorization);
        history.setPreviousStatus(previous);
        history.setNewStatus(next);
        history.setReason(reason);
        history.setChangedBy(changedBy);
        historyRepository.save(history);
    }

    private void notify(Long recipientId, String eventType, String title, String message, String deepLink) {
        notificationService.notify(
                recipientId, NotificationModule.MENTORING, eventType, title, message, deepLink);
    }

    private void recordAudit(
            ApidUserPrincipal actor,
            Long targetUserId,
            String action,
            Long authorizationId,
            Map<String, Object> details
    ) {
        auditService.record(new AuditService.AuditCommand(
                null,
                actor.getUserId(),
                actor.getUsername(),
                targetUserId,
                "MENTORING",
                action,
                "SUCCESS",
                null,
                "TRAINER_AUTHORIZATION",
                String.valueOf(authorizationId),
                details,
                null,
                null
        ));
    }

    private String normalizeOptional(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }
}
