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
import com.boa.apid.mentoring.application.entity.MentorApplicationType;
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
import com.boa.apid.mentoring.trainer.dto.HrMentorProfileDto;
import com.boa.apid.mentoring.trainer.dto.HrMentorProfileRequest;
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
import com.boa.apid.mentoring.trainer.entity.TrainerAuthorizationSkillStatus;
import com.boa.apid.mentoring.trainer.entity.TrainerStatusHistory;
import com.boa.apid.mentoring.trainer.repository.TrainerAuthorizationRepository;
import com.boa.apid.mentoring.trainer.repository.TrainerAuthorizationSkillStatusRepository;
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
    private final TrainerAuthorizationSkillStatusRepository skillStatusRepository;
    private final TrainerStatusHistoryRepository historyRepository;
    private final MentorApplicationRepository applicationRepository;
    private final EmployeeRepository employeeRepository;
    private final UserRepository userRepository;
    private final RoleRepository roleRepository;
    private final UserRoleRepository userRoleRepository;
    private final MentorAvailabilityService availabilityService;
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
            TrainerAuthorizationSkillStatusRepository skillStatusRepository,
            TrainerStatusHistoryRepository historyRepository,
            MentorApplicationRepository applicationRepository,
            EmployeeRepository employeeRepository,
            UserRepository userRepository,
            RoleRepository roleRepository,
            UserRoleRepository userRoleRepository,
            MentorAvailabilityService availabilityService,
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
        this.skillStatusRepository = skillStatusRepository;
        this.historyRepository = historyRepository;
        this.applicationRepository = applicationRepository;
        this.employeeRepository = employeeRepository;
        this.userRepository = userRepository;
        this.roleRepository = roleRepository;
        this.userRoleRepository = userRoleRepository;
        this.availabilityService = availabilityService;
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
                .filter(authorization -> hasActiveSkill(authorization, skillId))
                .toList();
        Set<Long> activeUserIds = userRepository.findAllById(
                        eligible.stream().map(authorization -> authorization.getEmployee().getUserId()).toList())
                .stream()
                .filter(user -> user.getStatus() == UserStatus.ACTIVE)
                .map(User::getId)
                .collect(java.util.stream.Collectors.toSet());
        Set<Long> unavailableUserIds = availabilityService.notAcceptingNewPairings(activeUserIds);
        return eligible.stream()
                .filter(authorization -> activeUserIds.contains(authorization.getEmployee().getUserId()))
                .filter(authorization -> !unavailableUserIds.contains(authorization.getEmployee().getUserId()))
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

    @Transactional(readOnly = true)
    public List<TrainerEmployeeCandidateDto> listMatchingEmployees() {
        List<Employee> employees = employeeRepository.findAllWithDetails().stream()
                .filter(employee -> employee.getEmploymentStatus() == EmploymentStatus.ACTIVE)
                .filter(employee -> employee.getUserId() != null)
                .toList();
        Set<Long> userIds = employees.stream().map(Employee::getUserId)
                .collect(java.util.stream.Collectors.toSet());
        Set<Long> activeUserIds = userRepository.findAllById(userIds).stream()
                .filter(user -> user.getStatus() == UserStatus.ACTIVE)
                .map(User::getId)
                .collect(java.util.stream.Collectors.toSet());

        return employees.stream()
                .filter(employee -> activeUserIds.contains(employee.getUserId()))
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
        if (authorizationRepository.existsByEmployeeAndStatuses(employee.getId(), LIVE_STATUSES)) {
            throw new BusinessException(
                    "TRAINER_ALREADY_AUTHORIZED",
                    "This employee already has a current trainer authorization.",
                    HttpStatus.CONFLICT
            );
        }
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
        saveSkillStatuses(saved, skills);
        saveStatusHistory(saved, null, null, TrainerAuthorizationStatus.ACTIVE,
                request.appointmentReason().trim(), appointingAdmin);
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
        TrainerAuthorizationSkillStatus skillStatus = skillStatusRepository
                .findByAuthorization_IdAndSkill_Id(authorizationId, request.skillId())
                .orElseThrow(() -> new ResourceNotFoundException("Trainer skill authorization not found"));
        TrainerAuthorizationStatus previous = skillStatus.getStatus();
        TrainerAuthorizationStatus next = request.status();
        validateStatusTransition(previous, next);
        String reason = request.reason().trim();

        if (next != TrainerAuthorizationStatus.ACTIVE) {
            if (request.inFlightPolicy() == null) {
                throw new BusinessException(
                        "IN_FLIGHT_POLICY_REQUIRED",
                        "Choose how existing relationships should be handled.",
                        HttpStatus.BAD_REQUEST
                );
            }
            cancelPendingRequests(authorization.getEmployee().getUserId(), request.skillId());
            if (request.inFlightPolicy() != TrainerInFlightPolicy.BLOCK_NEW_SESSIONS_ONLY) {
                pauseActiveRelationships(authorization.getEmployee().getUserId(), request.skillId());
            }
        }

        skillStatus.setStatus(next);
        skillStatus.setStatusReason(reason);
        skillStatusRepository.save(skillStatus);
        authorization.setStatus(aggregateStatus(
                skillStatusRepository.findByAuthorization_IdOrderBySkill_NameAsc(authorizationId)));
        TrainerAuthorization saved = authorizationRepository.save(authorization);
        User actorUser = userRepository.findById(actor.getUserId())
                .orElseThrow(() -> new ResourceNotFoundException("HR account not found"));
        saveStatusHistory(saved, skillStatus.getSkill(), previous, next, reason, actorUser);
        notify(authorization.getEmployee().getUserId(), "TRAINER_SKILL_STATUS_" + next.name(),
                "Mentor skill " + next.name().toLowerCase(),
                "Your authorization for " + skillStatus.getSkill().getName() + " is now "
                        + next.name().toLowerCase() + ". Reason: " + reason,
                "/mentoring?view=trainer");
        recordAudit(actor, authorization.getEmployee().getUserId(), "TRAINER_SKILL_STATUS_" + next.name(),
                saved.getId(), Map.of("previousStatus", previous.name(), "newStatus", next.name(),
                        "skillId", skillStatus.getSkill().getId(),
                        "skillName", skillStatus.getSkill().getName(),
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

    @Transactional(readOnly = true)
    public HrMentorProfileDto getHrMentorProfile(ApidUserPrincipal actor) {
        Employee employee = requireActiveEmployeeProfile(actor.getUserId());
        TrainerAuthorization authorization = authorizationRepository
                .findByEmployeeAndStatuses(employee.getId(), LIVE_STATUSES)
                .stream()
                .findFirst()
                .orElse(null);
        List<TrainerSkillDto> activeSkills = skillRepository.findAllByActiveTrueOrderByNameAsc().stream()
                .map(skill -> new TrainerSkillDto(skill.getId(), skill.getName(), skill.getCategory(), null, null))
                .toList();
        return new HrMentorProfileDto(
                availabilityService.isAcceptingNewPairings(actor.getUserId()),
                authorization == null,
                authorization == null ? null : toRosterDto(authorization),
                activeSkills
        );
    }

    @Transactional
    public HrMentorProfileDto updateHrMentorProfile(
            HrMentorProfileRequest request,
            ApidUserPrincipal actor
    ) {
        User user = userRepository.findByIdForUpdate(actor.getUserId())
                .orElseThrow(() -> new ResourceNotFoundException("HR account not found"));
        Employee employee = requireActiveEmployeeProfile(actor.getUserId());
        TrainerAuthorization authorization = authorizationRepository
                .findByEmployeeAndStatuses(employee.getId(), LIVE_STATUSES)
                .stream()
                .findFirst()
                .orElse(null);
        boolean acceptingNewPairings = request.acceptingNewPairings();
        boolean createdProfile = false;
        List<Long> skillIds = request.skillIds() == null ? List.of() : request.skillIds();

        if (authorization == null && acceptingNewPairings) {
            if (skillIds.isEmpty() || skillIds.size() > 2) {
                throw new BusinessException(
                        "HR_MENTOR_SKILLS_REQUIRED",
                        "Select one or two active skills to create your mentor profile."
                );
            }
            List<Long> uniqueSkillIds = new ArrayList<>(new LinkedHashSet<>(skillIds));
            if (uniqueSkillIds.size() != skillIds.size()) {
                throw new BusinessException("DUPLICATE_TRAINER_SKILL", "Choose each mentor skill only once.");
            }
            List<Skill> skills = resolveActiveSkills(uniqueSkillIds);
            authorization = new TrainerAuthorization();
            authorization.setEmployee(employee);
            authorization.setSourceType(TrainerAuthorizationSource.DIRECT_APPOINTMENT);
            authorization.setStatus(TrainerAuthorizationStatus.ACTIVE);
            authorization.setMaxConcurrentTrainees(
                    request.maxConcurrentTrainees() == null ? 3 : request.maxConcurrentTrainees());
            authorization.setAppointmentReason("HR administrator self-enabled mentor profile");
            authorization.setAuthorizedBy(user);
            authorization.setSkills(new LinkedHashSet<>(skills));
            authorization = authorizationRepository.save(authorization);
            saveSkillStatuses(authorization, skills);
            saveStatusHistory(
                    authorization,
                    null,
                    null,
                    TrainerAuthorizationStatus.ACTIVE,
                    "HR administrator self-enabled mentor profile",
                    user
            );
            assignMentorRole(user, user);
            createdProfile = true;
        } else if (authorization != null && !skillIds.isEmpty()) {
            authorization = addHrMentorSkills(authorization, skillIds, user);
        } else if (authorization == null && !skillIds.isEmpty()) {
            throw new BusinessException(
                    "HR_MENTOR_PROFILE_REQUIRED",
                    "Turn on your mentor badge to create a profile before adding skills."
            );
        }

        availabilityService.setAcceptingNewPairings(actor.getUserId(), acceptingNewPairings);
        Map<String, Object> auditDetails = new LinkedHashMap<>();
        auditDetails.put("acceptingNewPairings", acceptingNewPairings);
        auditDetails.put("profileCreated", createdProfile);
        auditDetails.put("skillIds", skillIds);
        String auditAction = skillIds.isEmpty()
                ? "HR_MENTOR_AVAILABILITY_UPDATED"
                : "HR_MENTOR_PROFILE_SKILLS_UPDATED";
        recordAudit(
                actor,
                actor.getUserId(),
                auditAction,
                authorization == null ? null : authorization.getId(),
                auditDetails
        );
        return getHrMentorProfile(actor);
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
        Set<Skill> applicationSkills = application.getCatalogSkills().isEmpty()
                ? (application.getCatalogSkill() == null ? Set.of() : Set.of(application.getCatalogSkill()))
                : application.getCatalogSkills();
        List<TrainerAuthorization> existingAuthorizations =
                authorizationRepository.findByEmployeeAndStatuses(employee.getId(), LIVE_STATUSES);
        if (!existingAuthorizations.isEmpty()) {
            TrainerAuthorization authorization = existingAuthorizations.get(0);
            Set<Skill> authorizedSkills = new LinkedHashSet<>(authorization.getSkills());
            authorizedSkills.addAll(applicationSkills);
            authorization.setSkills(authorizedSkills);
            TrainerAuthorization saved = authorizationRepository.save(authorization);

            String approvalSource = application.getApplicationType() == MentorApplicationType.SKILL_ADDITION
                    ? "Mentor skill addition request"
                    : "Mentor application";
            String approvalReason = application.getId() == null
                    ? approvalSource + " approved"
                    : approvalSource + " " + application.getId() + " approved";
            Map<Long, TrainerAuthorizationSkillStatus> statusesBySkillId =
                    new LinkedHashMap<>();
            skillStatusRepository.findByAuthorization_IdOrderBySkill_NameAsc(saved.getId())
                    .forEach(status -> statusesBySkillId.put(status.getSkill().getId(), status));
            List<TrainerAuthorizationSkillStatus> changedStatuses = new ArrayList<>();
            List<TrainerStatusHistory> statusHistory = new ArrayList<>();
            for (Skill skill : applicationSkills) {
                TrainerAuthorizationSkillStatus skillStatus = statusesBySkillId.get(skill.getId());
                TrainerAuthorizationStatus previousStatus = null;
                if (skillStatus == null) {
                    skillStatus = new TrainerAuthorizationSkillStatus();
                    skillStatus.setAuthorization(saved);
                    skillStatus.setSkill(skill);
                } else {
                    previousStatus = skillStatus.getStatus();
                    if (previousStatus == TrainerAuthorizationStatus.ACTIVE) {
                        continue;
                    }
                }
                skillStatus.setStatus(TrainerAuthorizationStatus.ACTIVE);
                skillStatus.setStatusReason(approvalReason);
                changedStatuses.add(skillStatus);

                TrainerStatusHistory history = new TrainerStatusHistory();
                history.setAuthorization(saved);
                history.setSkill(skill);
                history.setPreviousStatus(previousStatus);
                history.setNewStatus(TrainerAuthorizationStatus.ACTIVE);
                history.setReason(approvalReason);
                history.setChangedBy(reviewer);
                statusHistory.add(history);
            }
            if (!changedStatuses.isEmpty()) {
                skillStatusRepository.saveAll(changedStatuses);
                historyRepository.saveAll(statusHistory);
            }
            List<TrainerAuthorizationSkillStatus> updatedStatuses =
                    skillStatusRepository.findByAuthorization_IdOrderBySkill_NameAsc(saved.getId());
            if (!updatedStatuses.isEmpty()) {
                saved.setStatus(aggregateStatus(updatedStatuses));
            }
            return authorizationRepository.save(saved);
        }

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
        authorization.setSkills(new LinkedHashSet<>(applicationSkills));
        TrainerAuthorization saved = authorizationRepository.save(authorization);
        saveSkillStatuses(saved, applicationSkills);
        return saved;
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
                    List<TrainerAuthorization> skillTrainers = current.stream()
                            .filter(auth -> auth.getStatus() == TrainerAuthorizationStatus.ACTIVE)
                            .filter(auth -> hasActiveSkill(auth, skill.getId()))
                            .toList();
                    long trainers = skillTrainers.size();
                    long slots = skillTrainers.stream()
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
                current.stream()
                        .filter(auth -> auth.getStatus() == TrainerAuthorizationStatus.ACTIVE)
                        .filter(auth -> hasActiveSkill(auth, null))
                        .count(),
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
        if (previous != TrainerAuthorizationStatus.ACTIVE && next != TrainerAuthorizationStatus.ACTIVE) {
            throw new BusinessException(
                    "INVALID_TRAINER_STATUS_TRANSITION",
                    "Restore this skill before changing its status again."
            );
        }
    }

    private void cancelPendingRequests(Long mentorUserId, Long skillId) {
        if (mentorUserId == null) {
            return;
        }
        List<com.boa.apid.mentoring.pairing.entity.MentoringRequestRecipient> pending =
                recipientRepository.findByRequest_MentorUser_IdAndStatus(
                        mentorUserId, MentoringRequestRecipientStatus.PENDING).stream()
                        .filter(recipient -> recipient.getRequest().getSkill() != null
                                && recipient.getRequest().getSkill().getId().equals(skillId))
                        .toList();
        for (var recipient : pending) {
            recipient.setStatus(MentoringRequestRecipientStatus.CANCELLED);
            recipient.setRespondedAt(Instant.now());
            notificationService.notify(
                    recipient.getTraineeUser().getId(),
                    NotificationModule.MENTORING,
                    "MENTORING_REQUEST_CANCELLED",
                    "Mentoring request cancelled",
                    "A pending mentoring request was cancelled because the mentor's authorization for "
                            + recipient.getRequest().getSkill().getName() + " changed.",
                    "/mentoring?view=trainee"
            );
        }
        recipientRepository.saveAll(pending);
    }

    private void pauseActiveRelationships(Long mentorUserId, Long skillId) {
        if (mentorUserId == null) {
            return;
        }
        List<MentoringRelationship> relationships = relationshipRepository.findByMentorUser_IdAndStatus(
                mentorUserId, MentoringRelationshipStatus.ACTIVE).stream()
                .filter(relationship -> relationship.getRequest().getSkill() != null
                        && relationship.getRequest().getSkill().getId().equals(skillId))
                .toList();
        for (MentoringRelationship relationship : relationships) {
            relationship.setStatus(MentoringRelationshipStatus.PAUSED);
            memberRepository.findByRelationship_IdOrderByJoinedAtAsc(relationship.getId()).stream()
                    .filter(member -> member.getStatus()
                            == com.boa.apid.mentoring.pairing.entity.MentoringRelationshipMemberStatus.ACTIVE)
                    .forEach(member -> notify(
                            member.getTraineeUser().getId(),
                            "MENTORING_RELATIONSHIP_PAUSED",
                            "Mentoring relationship paused",
                            "This relationship was paused while HR reviews the mentor's authorization for "
                                    + relationship.getRequest().getSkill().getName() + ".",
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

    private Employee requireActiveEmployeeProfile(Long userId) {
        return employeeRepository.findDetailedByUserId(userId)
                .filter(employee -> employee.getEmploymentStatus() == EmploymentStatus.ACTIVE)
                .orElseThrow(() -> new BusinessException(
                        "ACTIVE_EMPLOYEE_PROFILE_REQUIRED",
                        "An active employee profile is required to become a mentor.",
                        HttpStatus.CONFLICT
                ));
    }

    private TrainerAuthorization addHrMentorSkills(
            TrainerAuthorization authorization,
            List<Long> skillIds,
            User actor
    ) {
        if (authorization.getStatus() != TrainerAuthorizationStatus.ACTIVE) {
            throw new BusinessException(
                    "HR_MENTOR_AUTHORIZATION_INACTIVE",
                    "Your mentor authorization must be active before updating its skills.",
                    HttpStatus.CONFLICT
            );
        }
        List<Long> uniqueSkillIds = new ArrayList<>(new LinkedHashSet<>(skillIds));
        if (uniqueSkillIds.size() != skillIds.size()) {
            throw new BusinessException("DUPLICATE_TRAINER_SKILL", "Choose each mentor skill only once.");
        }

        List<Skill> skillsToAdd = resolveActiveSkills(uniqueSkillIds);
        Map<Long, TrainerAuthorizationSkillStatus> statusesBySkillId = new LinkedHashMap<>();
        skillStatusRepository.findByAuthorization_IdOrderBySkill_NameAsc(authorization.getId())
                .forEach(status -> statusesBySkillId.put(status.getSkill().getId(), status));
        Set<Skill> authorizedSkills = new LinkedHashSet<>(authorization.getSkills());
        List<TrainerAuthorizationSkillStatus> changedStatuses = new ArrayList<>();
        List<TrainerStatusHistory> statusHistory = new ArrayList<>();
        String reason = "HR administrator updated mentor skills";

        for (Skill skill : skillsToAdd) {
            TrainerAuthorizationSkillStatus skillStatus = statusesBySkillId.get(skill.getId());
            TrainerAuthorizationStatus previousStatus = null;
            if (skillStatus == null) {
                skillStatus = new TrainerAuthorizationSkillStatus();
                skillStatus.setAuthorization(authorization);
                skillStatus.setSkill(skill);
            } else {
                throw new BusinessException(
                        skillStatus.getStatus() == TrainerAuthorizationStatus.ACTIVE
                                ? "MENTOR_SKILL_ALREADY_ACTIVE"
                                : "MENTOR_SKILL_STATUS_MANAGED_BY_HR",
                        skillStatus.getStatus() == TrainerAuthorizationStatus.ACTIVE
                                ? skill.getName() + " is already active on your mentor profile."
                                : skill.getName() + " already has an HR-managed status.",
                        HttpStatus.CONFLICT
                );
            }
            authorizedSkills.add(skill);
            skillStatus.setStatus(TrainerAuthorizationStatus.ACTIVE);
            skillStatus.setStatusReason(reason);
            changedStatuses.add(skillStatus);

            TrainerStatusHistory history = new TrainerStatusHistory();
            history.setAuthorization(authorization);
            history.setSkill(skill);
            history.setPreviousStatus(previousStatus);
            history.setNewStatus(TrainerAuthorizationStatus.ACTIVE);
            history.setReason(reason);
            history.setChangedBy(actor);
            statusHistory.add(history);
        }

        authorization.setSkills(authorizedSkills);
        TrainerAuthorization saved = authorizationRepository.save(authorization);
        skillStatusRepository.saveAll(changedStatuses);
        historyRepository.saveAll(statusHistory);
        List<TrainerAuthorizationSkillStatus> updatedStatuses =
                skillStatusRepository.findByAuthorization_IdOrderBySkill_NameAsc(saved.getId());
        if (!updatedStatuses.isEmpty()) {
            saved.setStatus(aggregateStatus(updatedStatuses));
        }
        return authorizationRepository.save(saved);
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
                authorization.getStatus() == TrainerAuthorizationStatus.ACTIVE
                        && userId != null
                        && availabilityService.isAcceptingNewPairings(userId),
                active,
                pending,
                authorization.getMaxConcurrentTrainees(),
                authorization.getBio(),
                authorization.getAvailabilityNotes(),
                skills(authorization, false),
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
                skills(authorization, true)
        );
    }

    private List<TrainerSkillDto> skills(TrainerAuthorization authorization, boolean activeOnly) {
        return skillStatusRepository.findByAuthorization_IdOrderBySkill_NameAsc(authorization.getId()).stream()
                .filter(status -> status.getSkill().isActive())
                .filter(status -> !activeOnly || status.getStatus() == TrainerAuthorizationStatus.ACTIVE)
                .map(status -> new TrainerSkillDto(
                        status.getSkill().getId(),
                        status.getSkill().getName(),
                        status.getSkill().getCategory(),
                        status.getStatus(),
                        status.getStatusReason()
                ))
                .toList();
    }

    private void saveSkillStatuses(TrainerAuthorization authorization, Iterable<Skill> skills) {
        List<TrainerAuthorizationSkillStatus> statuses = new ArrayList<>();
        for (Skill skill : skills) {
            TrainerAuthorizationSkillStatus status = new TrainerAuthorizationSkillStatus();
            status.setAuthorization(authorization);
            status.setSkill(skill);
            status.setStatus(TrainerAuthorizationStatus.ACTIVE);
            statuses.add(status);
        }
        skillStatusRepository.saveAll(statuses);
    }

    private boolean hasActiveSkill(TrainerAuthorization authorization, Long skillId) {
        return skillStatusRepository.findByAuthorization_IdOrderBySkill_NameAsc(authorization.getId()).stream()
                .anyMatch(status -> status.getStatus() == TrainerAuthorizationStatus.ACTIVE
                        && status.getSkill().isActive()
                        && (skillId == null || status.getSkill().getId().equals(skillId)));
    }

    private TrainerAuthorizationStatus aggregateStatus(List<TrainerAuthorizationSkillStatus> statuses) {
        if (statuses.isEmpty()) {
            throw new IllegalStateException("Trainer authorization has no skill status records.");
        }
        if (statuses.stream().anyMatch(status -> status.getStatus() == TrainerAuthorizationStatus.ACTIVE)) {
            return TrainerAuthorizationStatus.ACTIVE;
        }
        if (statuses.stream().anyMatch(status -> status.getStatus() == TrainerAuthorizationStatus.SUSPENDED)) {
            return TrainerAuthorizationStatus.SUSPENDED;
        }
        return TrainerAuthorizationStatus.REVOKED;
    }

    private void saveStatusHistory(
            TrainerAuthorization authorization,
            Skill skill,
            TrainerAuthorizationStatus previous,
            TrainerAuthorizationStatus next,
            String reason,
            User changedBy
    ) {
        TrainerStatusHistory history = new TrainerStatusHistory();
        history.setAuthorization(authorization);
        history.setSkill(skill);
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
