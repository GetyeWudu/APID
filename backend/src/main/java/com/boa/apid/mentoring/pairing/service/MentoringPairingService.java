package com.boa.apid.mentoring.pairing.service;

import com.boa.apid.common.exception.BusinessException;
import com.boa.apid.common.exception.ResourceNotFoundException;
import com.boa.apid.core.auth.security.ApidUserPrincipal;
import com.boa.apid.core.authorization.entity.User;
import com.boa.apid.core.authorization.entity.UserStatus;
import com.boa.apid.core.authorization.repository.UserRepository;
import com.boa.apid.core.authorization.repository.UserRoleRepository;
import com.boa.apid.core.config.service.CoreConfigService;
import com.boa.apid.core.notifications.entity.NotificationModule;
import com.boa.apid.core.notifications.service.NotificationService;
import com.boa.apid.core.organization.entity.Employee;
import com.boa.apid.core.organization.entity.EmploymentStatus;
import com.boa.apid.core.organization.repository.EmployeeRepository;
import com.boa.apid.core.skills.entity.Skill;
import com.boa.apid.mentoring.pairing.dto.MentorInvitationRequest;
import com.boa.apid.mentoring.pairing.dto.MentoringEmployeeCandidateDto;
import com.boa.apid.mentoring.pairing.dto.MentoringPairingDto;
import com.boa.apid.mentoring.pairing.dto.MentoringRequestDecision;
import com.boa.apid.mentoring.pairing.dto.TraineeMentorRequest;
import com.boa.apid.mentoring.pairing.entity.MentoringRelationship;
import com.boa.apid.mentoring.pairing.entity.MentoringRelationshipMember;
import com.boa.apid.mentoring.pairing.entity.MentoringRelationshipMemberStatus;
import com.boa.apid.mentoring.pairing.entity.MentoringRelationshipStatus;
import com.boa.apid.mentoring.pairing.entity.MentoringRequest;
import com.boa.apid.mentoring.pairing.entity.MentoringRequestRecipient;
import com.boa.apid.mentoring.pairing.entity.MentoringRequestRecipientStatus;
import com.boa.apid.mentoring.pairing.entity.MentoringRequestType;
import com.boa.apid.mentoring.pairing.repository.MentoringRelationshipRepository;
import com.boa.apid.mentoring.pairing.repository.MentoringRelationshipMemberRepository;
import com.boa.apid.mentoring.pairing.repository.MentoringRequestRecipientRepository;
import com.boa.apid.mentoring.pairing.repository.MentoringRequestRepository;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

@Service
public class MentoringPairingService {

    private final MentoringRequestRepository requestRepository;
    private final MentoringRequestRecipientRepository recipientRepository;
    private final MentoringRelationshipRepository relationshipRepository;
    private final MentoringRelationshipMemberRepository relationshipMemberRepository;
    private final UserRepository userRepository;
    private final UserRoleRepository userRoleRepository;
    private final EmployeeRepository employeeRepository;
    private final CoreConfigService coreConfigService;
    private final NotificationService notificationService;

    public MentoringPairingService(
            MentoringRequestRepository requestRepository,
            MentoringRequestRecipientRepository recipientRepository,
            MentoringRelationshipRepository relationshipRepository,
            MentoringRelationshipMemberRepository relationshipMemberRepository,
            UserRepository userRepository,
            UserRoleRepository userRoleRepository,
            EmployeeRepository employeeRepository,
            CoreConfigService coreConfigService,
            NotificationService notificationService
    ) {
        this.requestRepository = requestRepository;
        this.recipientRepository = recipientRepository;
        this.relationshipRepository = relationshipRepository;
        this.relationshipMemberRepository = relationshipMemberRepository;
        this.userRepository = userRepository;
        this.userRoleRepository = userRoleRepository;
        this.employeeRepository = employeeRepository;
        this.coreConfigService = coreConfigService;
        this.notificationService = notificationService;
    }

    @Transactional(readOnly = true)
    public List<MentoringEmployeeCandidateDto> listEmployeeCandidates(ApidUserPrincipal actor) {
        requireActiveMentor(actor.getUserId());

        List<Employee> employees = employeeRepository.findActiveLinkedEmployeesExceptUserId(actor.getUserId());
        if (employees.isEmpty()) {
            return List.of();
        }

        Set<Long> userIds = employees.stream().map(Employee::getUserId).collect(java.util.stream.Collectors.toSet());
        Map<Long, User> activeUsers = new LinkedHashMap<>();
        userRepository.findAllById(userIds).stream()
                .filter(user -> user.getStatus() == UserStatus.ACTIVE)
                .forEach(user -> activeUsers.put(user.getId(), user));

        return employees.stream()
                .filter(employee -> activeUsers.containsKey(employee.getUserId()))
                .map(employee -> new MentoringEmployeeCandidateDto(
                        employee.getUserId(),
                        employee.getEmployeeNumber(),
                        employee.getFullName(),
                        employee.getDepartmentName()
                ))
                .toList();
    }

    @Transactional(readOnly = true)
    public List<MentoringPairingDto> listMyRequests(ApidUserPrincipal actor) {
        List<MentoringRequestRecipient> recipients = recipientRepository.findVisibleToUser(actor.getUserId());
        Map<Long, Employee> employeesByUserId = loadEmployees(recipients.stream()
                .flatMap(recipient -> List.of(
                        recipient.getRequest().getMentorUser().getId(),
                        recipient.getTraineeUser().getId()
                ).stream())
                .toList());

        return recipients.stream()
                .map(recipient -> toDto(recipient, actor.getUserId(), employeesByUserId))
                .toList();
    }

    @Transactional
    public List<MentoringPairingDto> inviteTrainees(MentorInvitationRequest body, ApidUserPrincipal actor) {
        if (body == null || body.requestType() == null || body.traineeUserIds() == null) {
            throw new BusinessException("INVALID_MENTORING_INVITATION", "Choose a relationship type and at least one employee.");
        }

        User mentor = userRepository.findByIdForUpdate(actor.getUserId())
                .orElseThrow(() -> new ResourceNotFoundException("Mentor account not found"));
        ensureActiveMentor(mentor);

        List<Long> traineeIds = new ArrayList<>(new LinkedHashSet<>(body.traineeUserIds()));
        if (traineeIds.size() != body.traineeUserIds().size()) {
            throw new BusinessException("DUPLICATE_MENTORING_RECIPIENT", "An employee can only be selected once.");
        }
        if (traineeIds.contains(null)) {
            throw new BusinessException("INVALID_MENTORING_RECIPIENT", "Choose valid employee accounts.");
        }
        if (body.requestType() == MentoringRequestType.INDIVIDUAL && traineeIds.size() != 1) {
            throw new BusinessException("INVALID_MENTORING_GROUP_SIZE", "An individual invitation must target one employee.");
        }
        if (body.requestType() == MentoringRequestType.GROUP && traineeIds.size() < 2) {
            throw new BusinessException("INVALID_MENTORING_GROUP_SIZE", "A class invitation must target at least two employees.");
        }
        if (traineeIds.isEmpty()) {
            throw new BusinessException("MENTORING_RECIPIENT_REQUIRED", "Select at least one employee.");
        }

        Skill skill = resolveMentorSkill(mentor, body.skillId());
        String message = normalizeMessage(body.message());
        Map<Long, User> trainees = loadActiveEmployees(traineeIds, mentor.getId());
        for (Long traineeId : traineeIds) {
            ensureNoExistingPairRequest(mentor.getId(), traineeId);
        }
        long activeTrainees = relationshipRepository.countActiveTraineesByMentorUserId(
                mentor.getId(), MentoringRelationshipStatus.ACTIVE
        );
        long pendingInvitations = recipientRepository.countByMentorAndStatus(
                mentor.getId(), MentoringRequestRecipientStatus.PENDING
        );
        if (activeTrainees + pendingInvitations + traineeIds.size()
                > coreConfigService.getDefaultMaxTraineesPerTrainer()) {
            throw new BusinessException(
                    "MENTOR_CAPACITY_REACHED",
                    "There is not enough remaining capacity to invite the selected employees.",
                    HttpStatus.CONFLICT
            );
        }

        MentoringRequest request = new MentoringRequest();
        request.setMentorUser(mentor);
        request.setInitiatedByUser(mentor);
        request.setRequestType(body.requestType());
        request.setSkill(skill);
        request.setMessage(message);
        MentoringRequest savedRequest = requestRepository.save(request);

        String mentorName = employeeName(mentor.getId(), mentor);
        for (Long traineeId : traineeIds) {
            User trainee = trainees.get(traineeId);
            MentoringRequestRecipient recipient = new MentoringRequestRecipient();
            recipient.setRequest(savedRequest);
            recipient.setRecipientUser(trainee);
            recipient.setTraineeUser(trainee);
            recipientRepository.save(recipient);

            String relationshipLabel = body.requestType() == MentoringRequestType.GROUP
                    ? "a mentoring class"
                    : "one-to-one mentoring";
            notificationService.notify(
                    traineeId,
                    NotificationModule.MENTORING,
                    "MENTORING_PAIRING_REQUESTED",
                    body.requestType() == MentoringRequestType.GROUP ? "Mentoring class invitation" : "Mentoring invitation",
                    mentorName + " invited you to " + relationshipLabel
                            + (skill == null ? "." : " for " + skill.getName() + "."),
                    "/mentoring?view=trainee"
            );
        }

        return listMyRequests(actor).stream()
                .filter(item -> item.requestId().equals(savedRequest.getId()))
                .toList();
    }

    @Transactional
    public MentoringPairingDto requestMentor(TraineeMentorRequest body, ApidUserPrincipal actor) {
        if (body == null || body.mentorUserId() == null) {
            throw new BusinessException("MENTOR_REQUIRED", "Choose a mentor to request mentorship from.");
        }
        User trainee = requireActiveUser(actor.getUserId());
        ensureActiveEmployee(trainee.getId());
        if (trainee.getId().equals(body.mentorUserId())) {
            throw new BusinessException("SELF_MENTORING_REQUEST", "You cannot request mentorship from yourself.");
        }

        User mentor = userRepository.findByIdForUpdate(body.mentorUserId())
                .orElseThrow(() -> new ResourceNotFoundException("Mentor account not found"));
        ensureActiveMentor(mentor);
        Skill skill = resolveMentorSkill(mentor, body.skillId());
        ensureNoExistingPairRequest(mentor.getId(), trainee.getId());
        long activeTrainees = relationshipRepository.countActiveTraineesByMentorUserId(
                mentor.getId(), MentoringRelationshipStatus.ACTIVE
        );
        long pendingRequests = recipientRepository.countByMentorAndStatus(
                mentor.getId(), MentoringRequestRecipientStatus.PENDING
        );
        if (activeTrainees + pendingRequests >= coreConfigService.getDefaultMaxTraineesPerTrainer()) {
            throw new BusinessException(
                    "MENTOR_CAPACITY_REACHED",
                    "This mentor has no remaining capacity for new requests.",
                    HttpStatus.CONFLICT
            );
        }

        MentoringRequest request = new MentoringRequest();
        request.setMentorUser(mentor);
        request.setInitiatedByUser(trainee);
        request.setRequestType(MentoringRequestType.INDIVIDUAL);
        request.setSkill(skill);
        request.setMessage(normalizeMessage(body.message()));
        MentoringRequest savedRequest = requestRepository.save(request);

        MentoringRequestRecipient recipient = new MentoringRequestRecipient();
        recipient.setRequest(savedRequest);
        recipient.setRecipientUser(mentor);
        recipient.setTraineeUser(trainee);
        MentoringRequestRecipient savedRecipient = recipientRepository.save(recipient);

        String traineeName = employeeName(trainee.getId(), trainee);
        notificationService.notify(
                mentor.getId(),
                NotificationModule.MENTORING,
                "MENTORING_PAIRING_REQUESTED",
                "Mentorship request",
                traineeName + " requested one-to-one mentorship"
                        + (skill == null ? "." : " for " + skill.getName() + "."),
                "/mentoring?view=trainer"
        );

        return toDto(savedRecipient, trainee.getId(), loadEmployees(List.of(mentor.getId(), trainee.getId())));
    }

    @Transactional
    public MentoringPairingDto respond(Long recipientId, MentoringRequestDecision body, ApidUserPrincipal actor) {
        if (body == null || (body.decision() != MentoringRequestRecipientStatus.ACCEPTED
                && body.decision() != MentoringRequestRecipientStatus.DECLINED)) {
            throw new BusinessException("INVALID_MENTORING_REQUEST_DECISION", "Choose approve or decline.");
        }

        MentoringRequestRecipient recipient = recipientRepository.findByIdForUpdate(recipientId)
                .orElseThrow(() -> new ResourceNotFoundException("Mentoring request not found"));
        if (!recipient.getRecipientUser().getId().equals(actor.getUserId())) {
            throw new AccessDeniedException("Only the request recipient can respond.");
        }
        if (recipient.getStatus() != MentoringRequestRecipientStatus.PENDING) {
            throw new BusinessException(
                    "MENTORING_REQUEST_ALREADY_HANDLED",
                    "This mentoring request has already been handled.",
                    HttpStatus.CONFLICT
            );
        }

        MentoringRequest request = recipient.getRequest();
        User mentor = request.getMentorUser();
        User trainee = recipient.getTraineeUser();
        if (body.decision() == MentoringRequestRecipientStatus.ACCEPTED) {
            mentor = userRepository.findByIdForUpdate(mentor.getId())
                    .orElseThrow(() -> new ResourceNotFoundException("Mentor account not found"));
            ensureActiveMentor(mentor);
            ensureActiveEmployee(trainee.getId());
            if (relationshipRepository.existsActivePair(
                    mentor.getId(), trainee.getId(), MentoringRelationshipStatus.ACTIVE)) {
                throw new BusinessException(
                        "MENTORING_RELATIONSHIP_EXISTS",
                        "You already have an active mentoring relationship with this employee.",
                        HttpStatus.CONFLICT
                );
            }
            if (relationshipRepository.countActiveTraineesByMentorUserId(
                    mentor.getId(), MentoringRelationshipStatus.ACTIVE
            ) >= coreConfigService.getDefaultMaxTraineesPerTrainer()) {
                throw new BusinessException(
                        "MENTOR_CAPACITY_REACHED",
                        "This mentor has reached the maximum number of active trainees.",
                        HttpStatus.CONFLICT
                );
            }

            MentoringRelationship relationship = relationshipRepository.findByRequest_Id(request.getId())
                    .orElse(null);
            if (relationship != null && relationship.getStatus() != MentoringRelationshipStatus.ACTIVE) {
                throw new BusinessException(
                        "MENTORING_RELATIONSHIP_NOT_ACTIVE",
                        "This mentoring class or pairing is no longer active.",
                        HttpStatus.CONFLICT
                );
            }
            if (relationship == null) {
                MentoringRelationship newRelationship = new MentoringRelationship();
                newRelationship.setRequest(request);
                newRelationship.setMentorUser(mentor);
                relationship = relationshipRepository.save(newRelationship);
            }
            MentoringRelationshipMember member = new MentoringRelationshipMember();
            member.setRelationship(relationship);
            member.setRequestRecipient(recipient);
            member.setMentorUser(mentor);
            member.setTraineeUser(trainee);
            member.setStatus(MentoringRelationshipMemberStatus.ACTIVE);
            relationshipMemberRepository.save(member);
        }

        recipient.setStatus(body.decision());
        recipient.setRespondedAt(Instant.now());
        recipientRepository.save(recipient);

        boolean approved = body.decision() == MentoringRequestRecipientStatus.ACCEPTED;
        User initiator = request.getInitiatedByUser();
        String responderName = employeeName(actor.getUserId(), recipient.getRecipientUser());
        notificationService.notify(
                initiator.getId(),
                NotificationModule.MENTORING,
                approved ? "MENTORING_PAIRING_ACCEPTED" : "MENTORING_PAIRING_DECLINED",
                approved ? "Mentoring request approved" : "Mentoring request declined",
                responderName + (approved
                        ? " accepted your mentoring request."
                        : " declined your mentoring request."),
                request.getInitiatedByUser().getId().equals(mentor.getId())
                        ? "/mentoring?view=trainer"
                        : "/mentoring?view=trainee"
        );

        return toDto(recipient, actor.getUserId(), loadEmployees(List.of(mentor.getId(), trainee.getId())));
    }

    private Map<Long, User> loadActiveEmployees(List<Long> userIds, Long excludedUserId) {
        Map<Long, User> users = new LinkedHashMap<>();
        userRepository.findAllById(userIds).stream()
                .filter(user -> user.getStatus() == UserStatus.ACTIVE)
                .forEach(user -> users.put(user.getId(), user));

        for (Long userId : userIds) {
            if (userId.equals(excludedUserId)) {
                throw new BusinessException("SELF_MENTORING_REQUEST", "You cannot invite yourself.");
            }
            if (!users.containsKey(userId)
                    || !employeeRepository.existsByUserIdAndEmploymentStatus(userId, EmploymentStatus.ACTIVE)) {
                throw new ResourceNotFoundException("An active employee account could not be found.");
            }
        }
        return users;
    }

    private void ensureNoExistingPairRequest(Long mentorUserId, Long traineeUserId) {
        if (recipientRepository.existsByMentorTraineeAndStatus(
                mentorUserId, traineeUserId, MentoringRequestRecipientStatus.PENDING
        ) || relationshipRepository.existsActivePair(
                mentorUserId, traineeUserId, MentoringRelationshipStatus.ACTIVE
        )) {
            throw new BusinessException(
                    "MENTORING_PAIR_REQUEST_EXISTS",
                    "A request or active mentoring relationship already exists for this pair.",
                    HttpStatus.CONFLICT
            );
        }
    }

    private User requireActiveMentor(Long userId) {
        User mentor = requireActiveUser(userId);
        ensureActiveMentor(mentor);
        return mentor;
    }

    private User requireActiveUser(Long userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User account not found"));
        if (user.getStatus() != UserStatus.ACTIVE) {
            throw new BusinessException("INACTIVE_MENTORING_USER", "An inactive account cannot use mentoring.");
        }
        return user;
    }

    private void ensureActiveMentor(User mentor) {
        if (mentor.getStatus() != UserStatus.ACTIVE
                || !userRoleRepository.existsActiveMentorRoleByUserId(mentor.getId())) {
            throw new BusinessException(
                    "ACTIVE_MENTOR_REQUIRED",
                    "This action requires an active Mentor account.",
                    HttpStatus.FORBIDDEN
            );
        }
        if (!employeeRepository.existsByUserIdAndEmploymentStatus(mentor.getId(), EmploymentStatus.ACTIVE)) {
            throw new BusinessException(
                    "ACTIVE_MENTOR_REQUIRED",
                    "This action requires an active employee profile.",
                    HttpStatus.FORBIDDEN
            );
        }
    }

    private void ensureActiveEmployee(Long userId) {
        boolean activeAccount = userRepository.findById(userId)
                .map(user -> user.getStatus() == UserStatus.ACTIVE)
                .orElse(false);
        if (!activeAccount
                || !employeeRepository.existsByUserIdAndEmploymentStatus(userId, EmploymentStatus.ACTIVE)) {
            throw new BusinessException(
                    "ACTIVE_EMPLOYEE_REQUIRED",
                    "Mentoring requests are available only to active employees.",
                    HttpStatus.CONFLICT
            );
        }
    }

    private Skill resolveMentorSkill(User mentor, Long skillId) {
        if (skillId == null) {
            return null;
        }
        return mentor.getSkills().stream()
                .filter(Skill::isActive)
                .filter(skill -> skill.getId().equals(skillId))
                .findFirst()
                .orElseThrow(() -> new BusinessException(
                        "SKILL_NOT_AVAILABLE_FROM_MENTOR",
                        "Choose an active skill listed on this mentor's profile."
                ));
    }

    private String normalizeMessage(String message) {
        if (message == null || message.isBlank()) {
            return null;
        }
        String normalized = message.trim();
        if (normalized.length() > 1000) {
            throw new BusinessException("MENTORING_MESSAGE_TOO_LONG", "The request message must be 1000 characters or fewer.");
        }
        return normalized;
    }

    private Map<Long, Employee> loadEmployees(Collection<Long> userIds) {
        if (userIds.isEmpty()) {
            return Map.of();
        }
        Map<Long, Employee> result = new LinkedHashMap<>();
        employeeRepository.findDetailedByUserIdIn(userIds).forEach(employee -> result.put(employee.getUserId(), employee));
        return result;
    }

    private String employeeName(Long userId, User user) {
        return employeeRepository.findDetailedByUserId(userId)
                .map(Employee::getFullName)
                .orElse(user.getUsername());
    }

    private MentoringPairingDto toDto(
            MentoringRequestRecipient recipient,
            Long currentUserId,
            Map<Long, Employee> employeesByUserId
    ) {
        MentoringRequest request = recipient.getRequest();
        User mentor = request.getMentorUser();
        User trainee = recipient.getTraineeUser();
        Employee mentorEmployee = employeesByUserId.get(mentor.getId());
        Employee traineeEmployee = employeesByUserId.get(trainee.getId());
        return new MentoringPairingDto(
                recipient.getId(),
                request.getId(),
                request.getRequestType(),
                recipient.getStatus(),
                recipient.getRecipientUser().getId().equals(currentUserId),
                request.getInitiatedByUser().getId().equals(mentor.getId()),
                mentor.getId(),
                mentorEmployee == null ? mentor.getUsername() : mentorEmployee.getFullName(),
                trainee.getId(),
                traineeEmployee == null ? trainee.getUsername() : traineeEmployee.getFullName(),
                recipient.getRecipientUser().getId(),
                request.getSkill() == null ? null : request.getSkill().getId(),
                request.getSkill() == null ? null : request.getSkill().getName(),
                request.getMessage(),
                request.getCreatedAt(),
                recipient.getRespondedAt()
        );
    }

}
