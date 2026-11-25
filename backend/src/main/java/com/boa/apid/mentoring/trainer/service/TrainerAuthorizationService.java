package com.boa.apid.mentoring.trainer.service;

import com.boa.apid.common.exception.BusinessException;
import com.boa.apid.common.exception.ResourceNotFoundException;
import com.boa.apid.common.storage.FilePurpose;
import com.boa.apid.common.storage.FileStorageService;
import com.boa.apid.common.storage.StoredFile;
import com.boa.apid.core.organization.dto.OrganizationLocationDto;
import com.boa.apid.common.storage.StoredFileDto;
import com.boa.apid.common.storage.StoredFileRepository;
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
import com.boa.apid.mentoring.collaboration.dto.MentoringFeedbackRatingEntry;
import com.boa.apid.mentoring.collaboration.repository.MentoringRelationshipFeedbackRepository;
import com.boa.apid.mentoring.matching.entity.MentoringMatchRequestStatus;
import com.boa.apid.mentoring.matching.repository.MentoringMatchRequestRepository;
import com.boa.apid.mentoring.pairing.entity.MentoringRelationship;
import com.boa.apid.mentoring.pairing.entity.MentoringRelationshipMember;
import com.boa.apid.mentoring.pairing.entity.MentoringRelationshipMemberStatus;
import com.boa.apid.mentoring.pairing.entity.MentoringRelationshipStatus;
import com.boa.apid.mentoring.pairing.entity.MentoringRequestRecipientStatus;
import com.boa.apid.mentoring.pairing.entity.MentoringSession;
import com.boa.apid.mentoring.pairing.repository.MentoringRelationshipMemberRepository;
import com.boa.apid.mentoring.pairing.repository.MentoringRelationshipRepository;
import com.boa.apid.mentoring.pairing.repository.MentoringRequestRecipientRepository;
import com.boa.apid.mentoring.pairing.repository.MentoringSessionRatingRepository;
import com.boa.apid.mentoring.pairing.repository.MentoringSessionRepository;
import com.boa.apid.mentoring.pairing.entity.MentoringSessionStatus;
import com.boa.apid.mentoring.trainer.dto.MentorBadgeRemovalDecisionRequest;
import com.boa.apid.mentoring.trainer.dto.MentorBadgeRemovalRequestBody;
import com.boa.apid.mentoring.trainer.dto.MentorBadgeRemovalRequestDto;
import com.boa.apid.mentoring.trainer.dto.MentoringFeedbackReportDto;
import com.boa.apid.mentoring.trainer.dto.MentoringHrOverviewDto;
import com.boa.apid.mentoring.trainer.dto.MentoringRequestBacklogDto;
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
import com.boa.apid.mentoring.trainer.entity.TrainerAuthorizationSkillStatus;
import com.boa.apid.mentoring.trainer.entity.MentorBadgeRemovalDisposition;
import com.boa.apid.mentoring.trainer.entity.MentorBadgeRemovalRequest;
import com.boa.apid.mentoring.trainer.entity.MentorBadgeRemovalRequestStatus;
import com.boa.apid.mentoring.trainer.entity.TrainerStatusHistory;
import com.boa.apid.mentoring.trainer.repository.MentorBadgeRemovalRequestRepository;
import com.boa.apid.mentoring.trainer.repository.TrainerAuthorizationRepository;
import com.boa.apid.mentoring.trainer.repository.TrainerAuthorizationSkillStatusRepository;
import com.boa.apid.mentoring.trainer.repository.TrainerStatusHistoryRepository;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.time.Duration;
import java.time.Instant;
import java.time.YearMonth;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;

@Service
public class TrainerAuthorizationService {

    private static final List<TrainerAuthorizationStatus> LIVE_STATUSES =
            List.of(TrainerAuthorizationStatus.ACTIVE, TrainerAuthorizationStatus.SUSPENDED);

    private final TrainerAuthorizationRepository authorizationRepository;
    private final StoredFileRepository storedFileRepository;
    private final FileStorageService fileStorageService;
    private final TrainerAuthorizationSkillStatusRepository skillStatusRepository;
    private final TrainerStatusHistoryRepository historyRepository;
    private final MentorBadgeRemovalRequestRepository badgeRemovalRequestRepository;
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
    private final MentoringSessionRatingRepository sessionRatingRepository;
    private final MentoringRelationshipFeedbackRepository feedbackRepository;
    private final MentoringMatchRequestRepository matchRequestRepository;
    private final CoreConfigService configService;
    private final NotificationService notificationService;
    private final AuditService auditService;
    private final ApplicationEventPublisher eventPublisher;
    private final TrainerDirectoryProfileDetailsMapper profileDetailsMapper;

    public TrainerAuthorizationService(
            TrainerAuthorizationRepository authorizationRepository,
            StoredFileRepository storedFileRepository,
            FileStorageService fileStorageService,
            TrainerAuthorizationSkillStatusRepository skillStatusRepository,
            TrainerStatusHistoryRepository historyRepository,
            MentorBadgeRemovalRequestRepository badgeRemovalRequestRepository,
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
            MentoringSessionRatingRepository sessionRatingRepository,
            MentoringRelationshipFeedbackRepository feedbackRepository,
            MentoringMatchRequestRepository matchRequestRepository,
            CoreConfigService configService,
            NotificationService notificationService,
            AuditService auditService,
            ApplicationEventPublisher eventPublisher,
            TrainerDirectoryProfileDetailsMapper profileDetailsMapper
    ) {
        this.authorizationRepository = authorizationRepository;
        this.storedFileRepository = storedFileRepository;
        this.fileStorageService = fileStorageService;
        this.skillStatusRepository = skillStatusRepository;
        this.historyRepository = historyRepository;
        this.badgeRemovalRequestRepository = badgeRemovalRequestRepository;
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
        this.sessionRatingRepository = sessionRatingRepository;
        this.feedbackRepository = feedbackRepository;
        this.matchRequestRepository = matchRequestRepository;
        this.configService = configService;
        this.notificationService = notificationService;
        this.auditService = auditService;
        this.eventPublisher = eventPublisher;
        this.profileDetailsMapper = profileDetailsMapper;
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
                        .thenComparing(
                                TrainerDirectoryDto::averageRating,
                                Comparator.nullsLast(Comparator.reverseOrder())
                        )
                        .thenComparing(TrainerDirectoryDto::fullName, String.CASE_INSENSITIVE_ORDER))
                .toList();
    }

    @Transactional(readOnly = true)
    public List<OrganizationLocationDto> getOrganizationPath(Long userId) {
        Employee employee = employeeRepository.findDetailedByUserId(userId)
                .orElseThrow(() -> new ResourceNotFoundException("Employee profile not found"));
        return OrganizationLocationDto.path(employee);
    }

    @Transactional(readOnly = true)
    public TrainerDirectoryDto getDirectoryMentor(Long userId) {
        userRepository.findById(userId)
                .filter(user -> user.getStatus() == UserStatus.ACTIVE)
                .orElseThrow(() -> new ResourceNotFoundException("Mentor not found"));
        return authorizationRepository.findByUserIdAndStatus(userId, TrainerAuthorizationStatus.ACTIVE).stream()
                .filter(authorization -> authorization.getEmployee().getEmploymentStatus() == EmploymentStatus.ACTIVE)
                .filter(authorization -> hasActiveSkill(authorization, null))
                .findFirst()
                .map(this::toDirectoryDto)
                .orElseThrow(() -> new ResourceNotFoundException("Mentor not found"));
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
                        employee.getDepartmentName(),
                        OrganizationLocationDto.path(employee)
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
                        employee.getDepartmentName(),
                        OrganizationLocationDto.path(employee)
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
                "HR appointed you to mentor employees. Complete your mentoring profile.",
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
        if (request.bio() != null
                || request.experienceYears() != null
                || request.mentoringApproach() != null
                || request.sessionsPerWeek() != null
                || request.changeNote() != null) {
            throw new BusinessException(
                    "MENTOR_PROFILE_REVIEW_REQUIRED",
                    "Critical mentor profile changes must be submitted for HR review.",
                    HttpStatus.CONFLICT
            );
        }
        if (request.maxConcurrentTrainees() == null) {
            throw new BusinessException(
                    "MENTOR_PROFILE_CAPACITY_REQUIRED",
                    "Maximum concurrent trainees is required."
            );
        }
        TrainerAuthorization authorization = authorizationRepository.findByUserIdAndStatus(
                        actor.getUserId(), TrainerAuthorizationStatus.ACTIVE)
                .stream().findFirst()
                .orElseThrow(() -> new AccessDeniedException("Only an active mentor can update this profile."));
        validateProfileCapacity(actor.getUserId(), request.maxConcurrentTrainees());
        authorization.setMaxConcurrentTrainees(request.maxConcurrentTrainees());
        return toRosterDto(authorizationRepository.save(authorization));
    }

    @Transactional
    public TrainerRosterDto updateOwnProfilePicture(MultipartFile image, ApidUserPrincipal actor) {
        if (image == null || image.isEmpty()) {
            throw new BusinessException("MENTOR_PROFILE_PHOTO_REQUIRED", "Choose a profile picture to upload.");
        }
        TrainerAuthorization authorization = authorizationRepository.findByUserIdAndStatus(
                        actor.getUserId(), TrainerAuthorizationStatus.ACTIVE)
                .stream().findFirst()
                .orElseThrow(() -> new AccessDeniedException("Only an active mentor can update this profile."));
        StoredFileDto uploaded = fileStorageService.store(image, FilePurpose.MENTOR_PROFILE_PHOTO, actor);
        StoredFile profilePicture = storedFileRepository.findByIdAndDeletedFalse(uploaded.id())
                .orElseThrow(() -> new ResourceNotFoundException("Uploaded profile picture not found"));
        if (!actor.getUserId().equals(profilePicture.getUploadedByUserId())
                || profilePicture.getPurpose() != FilePurpose.MENTOR_PROFILE_PHOTO) {
            throw new AccessDeniedException("Profile pictures must be uploaded by the mentor.");
        }
        authorization.setProfilePicture(profilePicture);
        return toRosterDto(authorizationRepository.save(authorization));
    }

    @Transactional
    public TrainerRosterDto approveProfileUpdate(MentorApplication application, String profileSummary) {
        Long mentorUserId = application.getApplicant().getId();
        TrainerAuthorization authorization = authorizationRepository.findByUserIdAndStatus(
                        mentorUserId, TrainerAuthorizationStatus.ACTIVE)
                .stream().findFirst()
                .orElseThrow(() -> new BusinessException(
                        "ACTIVE_MENTOR_REQUIRED",
                        "The mentor authorization is no longer active.",
                        HttpStatus.CONFLICT
                ));
        authorization = authorizationRepository.findByIdForUpdate(authorization.getId())
                .orElseThrow(() -> new ResourceNotFoundException("Mentor authorization not found"));
        if (authorization.getStatus() != TrainerAuthorizationStatus.ACTIVE) {
            throw new BusinessException(
                    "ACTIVE_MENTOR_REQUIRED",
                    "The mentor authorization is no longer active.",
                    HttpStatus.CONFLICT
            );
        }
        MentorApplication existingProfileApplication = authorization.getSourceApplication();
        int requestedCapacity = application.getMaxConcurrentTrainees() == null
                ? authorization.getMaxConcurrentTrainees()
                : application.getMaxConcurrentTrainees();
        validateProfileCapacity(mentorUserId, requestedCapacity);
        authorization.setBio(application.getMentoringApproach());
        authorization.setMentoringApproach(application.getMentoringApproach());
        authorization.setExperienceYears(application.getExperienceYears());
        authorization.setSessionsPerWeek(application.getSessionsPerWeek());
        authorization.setMaxConcurrentTrainees(requestedCapacity);
        MentorApplication profileApplication = existingProfileApplication;
        if (profileApplication == null) {
            profileApplication = application;
            authorization.setSourceApplication(profileApplication);
        }
        profileApplication.setNote(application.getNote());
        profileApplication.setProfileSummary(profileSummary);
        profileApplication.setExperienceYears(application.getExperienceYears());
        profileApplication.setMentoringApproach(application.getMentoringApproach());
        profileApplication.setSessionsPerWeek(application.getSessionsPerWeek());
        profileApplication.setExpertiseSummary(application.getExpertiseSummary());
        Set<StoredFile> profileEvidence = new LinkedHashSet<>(profileApplication.getSupportingEvidence());
        profileEvidence.addAll(application.getSupportingEvidence());
        profileApplication.setSupportingEvidence(profileEvidence);
        Map<Long, String> mergedContexts = evidenceContexts(profileApplication);
        mergedContexts.putAll(evidenceContexts(application));
        profileApplication.setEvidenceContexts(encodeEvidenceContexts(mergedContexts));
        applicationRepository.save(profileApplication);
        return toRosterDto(authorizationRepository.save(authorization));
    }

    @Transactional(readOnly = true)
    public Optional<MentorApplication> findActiveProfileApplication(Long mentorUserId) {
        return authorizationRepository.findByUserIdAndStatus(
                        mentorUserId, TrainerAuthorizationStatus.ACTIVE)
                .stream()
                .map(TrainerAuthorization::getSourceApplication)
                .filter(Objects::nonNull)
                .filter(application -> application.getApplicationType() == MentorApplicationType.INITIAL)
                .findFirst();
    }

    @Transactional(readOnly = true)
    public void validateProfileCapacity(Long mentorUserId, int requestedCapacity) {
        long committedCapacity = relationshipRepository.countActiveTraineesByMentorUserId(
                mentorUserId, MentoringRelationshipStatus.ACTIVE)
                + recipientRepository.countByMentorAndStatus(
                        mentorUserId, MentoringRequestRecipientStatus.PENDING);
        if (requestedCapacity < committedCapacity) {
            throw new BusinessException(
                    "TRAINER_CAPACITY_BELOW_COMMITMENTS",
                    "Trainer capacity cannot be lower than active trainees plus pending requests.",
                    HttpStatus.CONFLICT
            );
        }
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
    public boolean hasMentorWorkspaceAccess(ApidUserPrincipal actor) {
        return !authorizationRepository.findByUserIdAndStatus(
                actor.getUserId(), TrainerAuthorizationStatus.ACTIVE
        ).isEmpty() || !authorizationRepository.findByUserIdAndStatus(
                actor.getUserId(), TrainerAuthorizationStatus.SUSPENDED
        ).isEmpty();
    }

    @Transactional(readOnly = true)
    public MentorBadgeRemovalRequestDto getMyBadgeRemovalRequest(ApidUserPrincipal actor) {
        TrainerAuthorization authorization = authorizationRepository
                .findByUserIdAndStatus(actor.getUserId(), TrainerAuthorizationStatus.ACTIVE)
                .stream()
                .findFirst()
                .orElse(null);
        return (authorization == null
                ? badgeRemovalRequestRepository
                    .findFirstByAuthorization_Employee_UserIdOrderByCreatedAtDesc(actor.getUserId())
                : badgeRemovalRequestRepository
                    .findFirstByAuthorization_IdOrderByCreatedAtDesc(authorization.getId()))
                .map(this::toBadgeRemovalRequestDto)
                .orElse(null);
    }

    @Transactional
    public MentorBadgeRemovalRequestDto submitBadgeRemovalRequest(
            MentorBadgeRemovalRequestBody body,
            ApidUserPrincipal actor
    ) {
        TrainerAuthorization currentAuthorization = authorizationRepository
                .findByUserIdAndStatus(actor.getUserId(), TrainerAuthorizationStatus.ACTIVE)
                .stream()
                .findFirst()
                .orElseThrow(() -> new AccessDeniedException("Only an active mentor can request badge removal."));
        TrainerAuthorization authorization = authorizationRepository.findByIdForUpdate(currentAuthorization.getId())
                .orElseThrow(() -> new ResourceNotFoundException("Mentor authorization not found"));
        if (authorization.getStatus() != TrainerAuthorizationStatus.ACTIVE) {
            throw new BusinessException(
                    "MENTOR_AUTHORIZATION_NOT_ACTIVE",
                    "Only an active mentor can request badge removal.",
                    HttpStatus.CONFLICT
            );
        }
        if (badgeRemovalRequestRepository.existsByAuthorization_IdAndStatus(
                authorization.getId(), MentorBadgeRemovalRequestStatus.PENDING)) {
            throw new BusinessException(
                    "MENTOR_BADGE_REMOVAL_ALREADY_PENDING",
                    "Your mentor badge removal request is already awaiting HR review.",
                    HttpStatus.CONFLICT
            );
        }
        MentorBadgeRemovalRequest previousRequest = badgeRemovalRequestRepository
                .findFirstByAuthorization_IdOrderByCreatedAtDesc(authorization.getId())
                .orElse(null);
        if (previousRequest != null && previousRequest.getStatus() == MentorBadgeRemovalRequestStatus.APPROVED) {
            throw new BusinessException(
                    "MENTOR_BADGE_REMOVAL_ALREADY_APPROVED",
                    "Your mentor badge removal request has already been approved.",
                    HttpStatus.CONFLICT
            );
        }
        User mentor = userRepository.findById(actor.getUserId())
                .orElseThrow(() -> new ResourceNotFoundException("Mentor account not found"));
        MentorBadgeRemovalRequest request = new MentorBadgeRemovalRequest();
        request.setAuthorization(authorization);
        request.setRequestedBy(mentor);
        request.setReason(normalizeOptional(body.reason()));
        MentorBadgeRemovalRequest saved = badgeRemovalRequestRepository.save(request);
        recordAudit(
                actor,
                mentor.getId(),
                "MENTOR_BADGE_REMOVAL_REQUESTED",
                authorization.getId(),
                Map.of("requestId", saved.getId())
        );
        return toBadgeRemovalRequestDto(saved);
    }

    @Transactional(readOnly = true)
    public List<MentorBadgeRemovalRequestDto> listPendingBadgeRemovalRequests() {
        return badgeRemovalRequestRepository
                .findByStatusOrderByCreatedAtAsc(MentorBadgeRemovalRequestStatus.PENDING)
                .stream()
                .map(this::toBadgeRemovalRequestDto)
                .toList();
    }

    @Transactional
    public MentorBadgeRemovalRequestDto decideBadgeRemovalRequest(
            Long requestId,
            MentorBadgeRemovalDecisionRequest decision,
            ApidUserPrincipal actor
    ) {
        if (decision.status() != MentorBadgeRemovalRequestStatus.APPROVED
                && decision.status() != MentorBadgeRemovalRequestStatus.DECLINED) {
            throw new BusinessException(
                    "INVALID_MENTOR_BADGE_REMOVAL_DECISION",
                    "Choose approve or decline for this request.",
                    HttpStatus.BAD_REQUEST
            );
        }
        if (decision.status() == MentorBadgeRemovalRequestStatus.APPROVED
                && decision.disposition() == null) {
            throw new BusinessException(
                    "MENTOR_BADGE_REMOVAL_DISPOSITION_REQUIRED",
                    "Choose whether to keep existing pairings or revoke all pairings.",
                    HttpStatus.BAD_REQUEST
            );
        }
        MentorBadgeRemovalRequest request = badgeRemovalRequestRepository.findByIdForUpdate(requestId)
                .orElseThrow(() -> new ResourceNotFoundException("Mentor badge removal request not found"));
        if (request.getStatus() != MentorBadgeRemovalRequestStatus.PENDING) {
            throw new BusinessException(
                    "MENTOR_BADGE_REMOVAL_ALREADY_REVIEWED",
                    "This mentor badge removal request has already been reviewed.",
                    HttpStatus.CONFLICT
            );
        }
        User reviewer = userRepository.findById(actor.getUserId())
                .orElseThrow(() -> new ResourceNotFoundException("HR account not found"));
        TrainerAuthorization authorization = authorizationRepository
                .findByIdForUpdate(request.getAuthorization().getId())
                .orElseThrow(() -> new ResourceNotFoundException("Mentor authorization not found"));
        String decisionReason = normalizeOptional(decision.decisionReason());

        request.setStatus(decision.status());
        request.setReviewedBy(reviewer);
        request.setReviewedAt(Instant.now());
        request.setDecisionReason(decisionReason);
        if (decision.status() == MentorBadgeRemovalRequestStatus.APPROVED) {
            request.setDisposition(decision.disposition());
            availabilityService.setAcceptingNewPairings(authorization.getEmployee().getUserId(), false);
            cancelAllPendingRequests(authorization.getEmployee().getUserId());
            if (decision.disposition() == MentorBadgeRemovalDisposition.REVOKE_ALL_PAIRINGS) {
                closeAllMentorRelationships(authorization.getEmployee().getUserId(), decisionReason);
                revokeMentorAuthorization(authorization, reviewer, decisionReason);
            }
        } else {
            request.setDisposition(null);
        }
        MentorBadgeRemovalRequest saved = badgeRemovalRequestRepository.save(request);
        String message = decision.status() == MentorBadgeRemovalRequestStatus.DECLINED
                ? "HR declined your request to remove your mentor badge."
                : decision.disposition() == MentorBadgeRemovalDisposition.REVOKE_ALL_PAIRINGS
                    ? "HR approved your request. Your mentor authorization and active pairings have been closed."
                    : "HR approved your request. Existing pairings remain active, and you will not receive new matches.";
        if (decisionReason != null) {
            message += " HR note: " + decisionReason;
        }
        notify(
                authorization.getEmployee().getUserId(),
                "MENTOR_BADGE_REMOVAL_" + decision.status().name(),
                decision.status() == MentorBadgeRemovalRequestStatus.APPROVED
                        ? "Mentor badge removal approved"
                        : "Mentor badge removal declined",
                message,
                "/mentoring?view=trainer"
        );
        Map<String, Object> auditDetails = new LinkedHashMap<>();
        auditDetails.put("requestId", saved.getId());
        auditDetails.put("decision", decision.status().name());
        auditDetails.put("disposition", decision.disposition() == null ? "" : decision.disposition().name());
        auditDetails.put("decisionReason", decisionReason == null ? "" : decisionReason);
        recordAudit(
                actor,
                authorization.getEmployee().getUserId(),
                "MENTOR_BADGE_REMOVAL_" + decision.status().name(),
                authorization.getId(),
                auditDetails
        );
        return toBadgeRemovalRequestDto(saved);
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
            if (application.getApplicationType() == MentorApplicationType.INITIAL
                    && authorization.getSourceApplication() == null) {
                authorization.setSourceApplication(application);
                if (authorization.getProfilePicture() == null) {
                    authorization.setProfilePicture(profilePictureEvidence(application));
                }
            }
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
        authorization.setProfilePicture(profilePictureEvidence(application));
        authorization.setStatus(TrainerAuthorizationStatus.ACTIVE);
        authorization.setMaxConcurrentTrainees(application.getMaxConcurrentTrainees() == null
                ? configService.getDefaultMaxTraineesPerTrainer()
                : application.getMaxConcurrentTrainees());
        String mentoringApproach = application.getMentoringApproach() == null
                ? application.getExpertiseSummary()
                : application.getMentoringApproach();
        authorization.setBio(mentoringApproach);
        authorization.setMentoringApproach(mentoringApproach);
        authorization.setExperienceYears(application.getExperienceYears());
        authorization.setSessionsPerWeek(application.getSessionsPerWeek());
        authorization.setAuthorizedBy(reviewer);
        authorization.setSkills(new LinkedHashSet<>(applicationSkills));
        TrainerAuthorization saved = authorizationRepository.save(authorization);
        saveSkillStatuses(saved, applicationSkills);
        return saved;
    }

    @Transactional(readOnly = true)
    public MentoringHrOverviewDto getOverview() {
        MentoringRequestBacklogDto requestBacklog = summarizeRequestBacklog(
                matchRequestRepository.findByStatusOrderByCreatedAtAsc(MentoringMatchRequestStatus.OPEN)
                        .stream()
                        .map(request -> request.getCreatedAt())
                        .toList(),
                Instant.now()
        );
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
        MentoringFeedbackReportDto feedbackReport = summarizeFeedbackRatings(
                feedbackRepository.findAllRatingEntries(),
                YearMonth.now(ZoneOffset.UTC)
        );
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
                feedbackReport.averageRating(),
                totalRelationships == 0 ? 0
                        : Math.round(completedRelationships * 1000.0 / totalRelationships) / 10.0,
                supply,
                requestBacklog,
                feedbackReport
        );
    }

    static MentoringFeedbackReportDto summarizeFeedbackRatings(
            List<MentoringFeedbackRatingEntry> entries,
            YearMonth currentMonth
    ) {
        long[] ratingCounts = new long[5];
        long ratingTotal = 0;
        long ratingSum = 0;
        YearMonth firstTrendMonth = currentMonth.minusMonths(5);
        Map<YearMonth, Long> monthlyCounts = new LinkedHashMap<>();
        Map<YearMonth, Long> monthlySums = new LinkedHashMap<>();

        for (int monthOffset = 0; monthOffset < 6; monthOffset++) {
            YearMonth month = firstTrendMonth.plusMonths(monthOffset);
            monthlyCounts.put(month, 0L);
            monthlySums.put(month, 0L);
        }

        for (MentoringFeedbackRatingEntry entry : entries) {
            if (entry.rating() < 1 || entry.rating() > 5) {
                throw new IllegalStateException("Mentoring feedback rating must be between 1 and 5.");
            }
            ratingCounts[entry.rating() - 1]++;
            ratingTotal++;
            ratingSum += entry.rating();

            YearMonth ratedMonth = YearMonth.from(entry.ratedAt().atZone(ZoneOffset.UTC));
            if (monthlyCounts.containsKey(ratedMonth)) {
                monthlyCounts.compute(ratedMonth, (ignored, count) -> count + 1);
                monthlySums.compute(ratedMonth, (ignored, sum) -> sum + entry.rating());
            }
        }

        List<MentoringFeedbackReportDto.RatingDistribution> distribution = new ArrayList<>();
        for (int rating = 1; rating <= 5; rating++) {
            distribution.add(new MentoringFeedbackReportDto.RatingDistribution(
                    rating,
                    ratingCounts[rating - 1]
            ));
        }
        List<MentoringFeedbackReportDto.MonthlyRating> monthlyTrend = monthlyCounts.keySet().stream()
                .map(month -> {
                    long count = monthlyCounts.get(month);
                    Double average = count == 0
                            ? null
                            : monthlySums.get(month) / (double) count;
                    return new MentoringFeedbackReportDto.MonthlyRating(month.toString(), count, average);
                })
                .toList();
        Double averageRating = ratingTotal == 0
                ? null
                : ratingSum / (double) ratingTotal;
        return new MentoringFeedbackReportDto(
                ratingTotal,
                averageRating,
                distribution,
                monthlyTrend
        );
    }

    static MentoringRequestBacklogDto summarizeRequestBacklog(List<Instant> createdAtValues, Instant now) {
        long totalAgeSeconds = 0;
        long oldestAgeSeconds = 0;
        long underTwoDays = 0;
        long twoToSevenDays = 0;
        long sevenOrMoreDays = 0;

        for (Instant createdAt : createdAtValues) {
            long ageSeconds = Math.max(0, Duration.between(createdAt, now).getSeconds());
            totalAgeSeconds += ageSeconds;
            oldestAgeSeconds = Math.max(oldestAgeSeconds, ageSeconds);
            if (ageSeconds < Duration.ofDays(2).getSeconds()) {
                underTwoDays++;
            } else if (ageSeconds < Duration.ofDays(7).getSeconds()) {
                twoToSevenDays++;
            } else {
                sevenOrMoreDays++;
            }
        }

        if (createdAtValues.isEmpty()) {
            return new MentoringRequestBacklogDto(0, 0, 0, 0, 0, 0);
        }
        double averageWaitDays = totalAgeSeconds / (double) createdAtValues.size() / Duration.ofDays(1).getSeconds();
        return new MentoringRequestBacklogDto(
                createdAtValues.size(),
                roundToOneDecimal(averageWaitDays),
                roundToOneDecimal(oldestAgeSeconds / (double) Duration.ofDays(1).getSeconds()),
                underTwoDays,
                twoToSevenDays,
                sevenOrMoreDays
        );
    }

    private static double roundToOneDecimal(double value) {
        return Math.round(value * 10.0) / 10.0;
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

    private void cancelAllPendingRequests(Long mentorUserId) {
        List<com.boa.apid.mentoring.pairing.entity.MentoringRequestRecipient> pending =
                recipientRepository.findByRequest_MentorUser_IdAndStatus(
                        mentorUserId, MentoringRequestRecipientStatus.PENDING);
        Instant now = Instant.now();
        for (var recipient : pending) {
            recipient.setStatus(MentoringRequestRecipientStatus.CANCELLED);
            recipient.setRespondedAt(now);
            notify(
                    recipient.getTraineeUser().getId(),
                    "MENTORING_REQUEST_CANCELLED",
                    "Mentoring request cancelled",
                    "A pending mentoring request was cancelled because the mentor's badge removal was approved.",
                    "/mentoring?view=trainee"
            );
        }
        recipientRepository.saveAll(pending);
    }

    private void closeAllMentorRelationships(Long mentorUserId, String decisionReason) {
        List<MentoringRelationship> relationships = relationshipRepository.findByMentorUser_IdAndStatusIn(
                mentorUserId,
                List.of(MentoringRelationshipStatus.ACTIVE, MentoringRelationshipStatus.PAUSED)
        );
        if (relationships.isEmpty()) {
            return;
        }
        Instant now = Instant.now();
        String closeReason = decisionReason == null
                ? "HR approved mentor badge removal and closed this relationship."
                : decisionReason;
        List<Long> relationshipIds = relationships.stream().map(MentoringRelationship::getId).toList();
        List<MentoringSession> sessions =
                sessionRepository.findByRelationship_IdInOrderByScheduledStartDesc(relationshipIds);
        for (MentoringSession session : sessions) {
            if ((session.getStatus() == MentoringSessionStatus.SCHEDULED
                    || session.getStatus() == MentoringSessionStatus.RESCHEDULED)
                    && session.getScheduledStart().isAfter(now)) {
                session.setStatus(MentoringSessionStatus.CANCELLED);
            }
        }
        sessionRepository.saveAll(sessions);

        for (MentoringRelationship relationship : relationships) {
            relationship.setStatus(MentoringRelationshipStatus.CANCELLED);
            relationship.setEndedAt(now);
            List<MentoringRelationshipMember> members =
                    memberRepository.findByRelationship_IdOrderByJoinedAtAsc(relationship.getId());
            for (MentoringRelationshipMember member : members) {
                if (member.getStatus() == MentoringRelationshipMemberStatus.ACTIVE) {
                    member.setStatus(MentoringRelationshipMemberStatus.CANCELLED);
                    member.setEndedAt(now);
                    notify(
                            member.getTraineeUser().getId(),
                            "MENTORING_RELATIONSHIP_CANCELLED",
                            "Mentoring relationship cancelled",
                            "Your mentoring relationship has been cancelled because HR approved the mentor's badge removal. "
                                    + closeReason,
                            "/mentoring/pairing/" + relationship.getId()
                    );
                }
            }
            memberRepository.saveAll(members);
        }
        relationshipRepository.saveAll(relationships);
    }

    private void revokeMentorAuthorization(
            TrainerAuthorization authorization,
            User reviewer,
            String decisionReason
    ) {
        String reason = decisionReason == null
                ? "Mentor authorization revoked after badge removal request approval."
                : decisionReason;
        TrainerAuthorizationStatus previousStatus = authorization.getStatus();
        authorization.setStatus(TrainerAuthorizationStatus.REVOKED);
        authorization.setStatusReason(reason);
        authorizationRepository.save(authorization);
        for (TrainerAuthorizationSkillStatus skillStatus
                : skillStatusRepository.findByAuthorization_IdOrderBySkill_NameAsc(authorization.getId())) {
            TrainerAuthorizationStatus previousSkillStatus = skillStatus.getStatus();
            if (previousSkillStatus == TrainerAuthorizationStatus.REVOKED) {
                continue;
            }
            skillStatus.setStatus(TrainerAuthorizationStatus.REVOKED);
            skillStatus.setStatusReason(reason);
            TrainerStatusHistory history = new TrainerStatusHistory();
            history.setAuthorization(authorization);
            history.setSkill(skillStatus.getSkill());
            history.setPreviousStatus(previousSkillStatus);
            history.setNewStatus(TrainerAuthorizationStatus.REVOKED);
            history.setReason(reason);
            history.setChangedBy(reviewer);
            historyRepository.save(history);
        }
        saveStatusHistory(
                authorization,
                null,
                previousStatus,
                TrainerAuthorizationStatus.REVOKED,
                reason,
                reviewer
        );
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
        MentorApplication profileApplication = authorization.getSourceApplication();
        if (profileApplication != null
                && profileApplication.getApplicationType() != MentorApplicationType.INITIAL) {
            profileApplication = null;
        }
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
                skills(authorization, false),
                authorization.getEffectiveFrom(),
                authorization.getUpdatedAt(),
                authorization.getExperienceYears(),
                authorization.getMentoringApproach(),
                authorization.getSessionsPerWeek(),
                authorization.getProfilePicture() == null ? null : authorization.getProfilePicture().getId(),
                authorization.getProfilePicture() == null
                        ? null : authorization.getProfilePicture().getOriginalFilename(),
                profileApplication == null ? null : profileApplication.getNote(),
                profileApplicationEvidence(profileApplication),
                OrganizationLocationDto.path(employee)
        );
    }

    private StoredFile profilePictureEvidence(MentorApplication application) {
        Map<Long, String> contexts = evidenceContexts(application);
        return application.getSupportingEvidence().stream()
                .filter(file -> "Profile picture".equals(contexts.get(file.getId())))
                .filter(file -> file.getContentType() != null && file.getContentType().startsWith("image/"))
                .findFirst()
                .orElse(null);
    }

    private List<TrainerRosterDto.ProfileEvidence> profileApplicationEvidence(MentorApplication application) {
        if (application == null) {
            return List.of();
        }
        Map<Long, String> contexts = evidenceContexts(application);
        List<TrainerRosterDto.ProfileEvidence> evidence = application.getSupportingEvidence().stream()
                .map(file -> new TrainerRosterDto.ProfileEvidence(
                        file.getId(),
                        file.getOriginalFilename(),
                        contexts.getOrDefault(file.getId(), "Supporting evidence")
                ))
                .toList();
        if (evidence.isEmpty() && application.getProofDocument() != null) {
            return List.of(new TrainerRosterDto.ProfileEvidence(
                    application.getProofDocument().getId(),
                    application.getProofDocument().getOriginalFilename(),
                    contexts.getOrDefault(application.getProofDocument().getId(), "Supporting evidence")
            ));
        }
        return evidence;
    }

    private Map<Long, String> evidenceContexts(MentorApplication application) {
        Map<Long, String> contexts = new LinkedHashMap<>();
        String serialized = application.getEvidenceContexts();
        if (serialized == null || serialized.isBlank()) {
            return contexts;
        }

        for (String line : serialized.split("\\r?\\n")) {
            int separator = line.indexOf('\t');
            if (separator <= 0) {
                throw new IllegalStateException("Invalid mentor application evidence context metadata");
            }
            try {
                contexts.put(Long.parseLong(line.substring(0, separator)), line.substring(separator + 1));
            } catch (NumberFormatException error) {
                throw new IllegalStateException("Invalid mentor application evidence context metadata", error);
            }
        }
        return contexts;
    }

    private String encodeEvidenceContexts(Map<Long, String> contexts) {
        return contexts.entrySet().stream()
                .map(entry -> entry.getKey() + "\t" + entry.getValue()
                        .replaceAll("[\\t\\r\\n]", " ").trim())
                .collect(java.util.stream.Collectors.joining("\n"));
    }

    private MentorBadgeRemovalRequestDto toBadgeRemovalRequestDto(MentorBadgeRemovalRequest request) {
        TrainerAuthorization authorization = request.getAuthorization();
        Employee employee = authorization.getEmployee();
        return new MentorBadgeRemovalRequestDto(
                request.getId(),
                authorization.getId(),
                employee.getEmployeeNumber(),
                employee.getFullName(),
                employee.getDepartmentName(),
                skills(authorization, false).stream().map(TrainerSkillDto::name).toList(),
                request.getReason(),
                request.getStatus(),
                request.getCreatedAt(),
                request.getReviewedAt(),
                request.getDisposition(),
                request.getDecisionReason(),
                OrganizationLocationDto.path(employee)
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
        long ratedSessionCount =
                sessionRatingRepository.countEndedSessionsWithRatingsByMentorUserId(user.getId());
        Double averageRating = ratedSessionCount >= 5
                ? sessionRatingRepository.averageEndedByMentorUserId(user.getId())
                : null;
        MentorApplication sourceApplication = authorization.getSourceApplication();
        if (sourceApplication != null
                && sourceApplication.getApplicationType() != MentorApplicationType.INITIAL) {
            sourceApplication = null;
        }
        TrainerDirectoryProfileDetailsMapper.ProfileDetails profileDetails = profileDetailsMapper.map(
                sourceApplication == null ? null : sourceApplication.getNote(),
                user.getId()
        );
        return new TrainerDirectoryDto(
                user.getId(),
                user.getUsername(),
                employee.getEmployeeNumber(),
                employee.getFullName(),
                employee.getDepartmentName(),
                authorization.getBio(),
                active,
                Math.max(0, authorization.getMaxConcurrentTrainees() - active - pending),
                averageRating,
                skills(authorization, true),
                authorization.getExperienceYears(),
                authorization.getMentoringApproach(),
                authorization.getSessionsPerWeek(),
                profileDetails.education(),
                profileDetails.professionalCertificates(),
                OrganizationLocationDto.path(employee)
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
