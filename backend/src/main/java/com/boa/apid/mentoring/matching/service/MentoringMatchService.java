package com.boa.apid.mentoring.matching.service;

import com.boa.apid.common.exception.BusinessException;
import com.boa.apid.common.exception.ResourceNotFoundException;
import com.boa.apid.core.audit.service.AuditService;
import com.boa.apid.core.auth.security.ApidUserPrincipal;
import com.boa.apid.core.authorization.entity.User;
import com.boa.apid.core.authorization.entity.UserStatus;
import com.boa.apid.core.authorization.repository.UserRepository;
import com.boa.apid.core.notifications.entity.NotificationModule;
import com.boa.apid.core.notifications.service.NotificationService;
import com.boa.apid.core.organization.entity.Employee;
import com.boa.apid.core.organization.entity.EmploymentStatus;
import com.boa.apid.core.organization.repository.EmployeeRepository;
import com.boa.apid.core.skills.entity.Skill;
import com.boa.apid.core.skills.repository.SkillRepository;
import com.boa.apid.mentoring.matching.dto.MentoringMatchAssignmentInput;
import com.boa.apid.mentoring.matching.dto.MentoringDirectMatchInput;
import com.boa.apid.mentoring.matching.dto.MentoringDirectMatchResultDto;
import com.boa.apid.mentoring.matching.dto.MentoringMatchRequestDto;
import com.boa.apid.mentoring.matching.dto.MentoringMatchRequestInput;
import com.boa.apid.mentoring.matching.dto.MentoringReassignmentCandidateDto;
import com.boa.apid.mentoring.matching.dto.MentoringReassignmentInput;
import com.boa.apid.mentoring.matching.dto.MentoringReassignmentResultDto;
import com.boa.apid.mentoring.matching.entity.MentoringMatchRequest;
import com.boa.apid.mentoring.matching.entity.MentoringMatchRequestStatus;
import com.boa.apid.mentoring.matching.repository.MentoringMatchRequestRepository;
import com.boa.apid.mentoring.pairing.entity.MentoringRelationship;
import com.boa.apid.mentoring.pairing.entity.MentoringRelationshipMember;
import com.boa.apid.mentoring.pairing.entity.MentoringRelationshipMemberStatus;
import com.boa.apid.mentoring.pairing.entity.MentoringRelationshipStatus;
import com.boa.apid.mentoring.pairing.entity.MentoringRequest;
import com.boa.apid.mentoring.pairing.entity.MentoringRequestRecipient;
import com.boa.apid.mentoring.pairing.entity.MentoringRequestRecipientStatus;
import com.boa.apid.mentoring.pairing.entity.MentoringRequestType;
import com.boa.apid.mentoring.pairing.repository.MentoringRelationshipMemberRepository;
import com.boa.apid.mentoring.pairing.repository.MentoringRelationshipRepository;
import com.boa.apid.mentoring.pairing.repository.MentoringRequestRecipientRepository;
import com.boa.apid.mentoring.pairing.repository.MentoringRequestRepository;
import com.boa.apid.mentoring.trainer.entity.TrainerAuthorization;
import com.boa.apid.mentoring.trainer.entity.TrainerAuthorizationStatus;
import com.boa.apid.mentoring.trainer.repository.TrainerAuthorizationRepository;
import com.boa.apid.mentoring.trainer.repository.TrainerAuthorizationSkillStatusRepository;
import com.boa.apid.mentoring.trainer.service.MentorAvailabilityService;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
public class MentoringMatchService {

    private final MentoringMatchRequestRepository matchRequestRepository;
    private final EmployeeRepository employeeRepository;
    private final UserRepository userRepository;
    private final SkillRepository skillRepository;
    private final TrainerAuthorizationRepository trainerAuthorizationRepository;
    private final TrainerAuthorizationSkillStatusRepository skillStatusRepository;
    private final MentorAvailabilityService availabilityService;
    private final MentoringRequestRepository mentoringRequestRepository;
    private final MentoringRequestRecipientRepository recipientRepository;
    private final MentoringRelationshipRepository relationshipRepository;
    private final MentoringRelationshipMemberRepository memberRepository;
    private final NotificationService notificationService;
    private final AuditService auditService;

    public MentoringMatchService(
            MentoringMatchRequestRepository matchRequestRepository,
            EmployeeRepository employeeRepository,
            UserRepository userRepository,
            SkillRepository skillRepository,
            TrainerAuthorizationRepository trainerAuthorizationRepository,
            TrainerAuthorizationSkillStatusRepository skillStatusRepository,
            MentorAvailabilityService availabilityService,
            MentoringRequestRepository mentoringRequestRepository,
            MentoringRequestRecipientRepository recipientRepository,
            MentoringRelationshipRepository relationshipRepository,
            MentoringRelationshipMemberRepository memberRepository,
            NotificationService notificationService,
            AuditService auditService
    ) {
        this.matchRequestRepository = matchRequestRepository;
        this.employeeRepository = employeeRepository;
        this.userRepository = userRepository;
        this.skillRepository = skillRepository;
        this.trainerAuthorizationRepository = trainerAuthorizationRepository;
        this.skillStatusRepository = skillStatusRepository;
        this.availabilityService = availabilityService;
        this.mentoringRequestRepository = mentoringRequestRepository;
        this.recipientRepository = recipientRepository;
        this.relationshipRepository = relationshipRepository;
        this.memberRepository = memberRepository;
        this.notificationService = notificationService;
        this.auditService = auditService;
    }

    @Transactional
    public MentoringMatchRequestDto submit(MentoringMatchRequestInput input, ApidUserPrincipal actor) {
        Employee employee = employeeRepository.findDetailedByUserId(actor.getUserId())
                .filter(candidate -> candidate.getEmploymentStatus() == EmploymentStatus.ACTIVE)
                .orElseThrow(() -> new BusinessException(
                        "ACTIVE_EMPLOYEE_REQUIRED",
                        "Only an active employee can request HR mentoring matching.",
                        HttpStatus.CONFLICT
                ));
        Skill skill = skillRepository.findByIdAndActiveTrue(input.skillId())
                .orElseThrow(() -> new ResourceNotFoundException("Active skill not found"));
        if (matchRequestRepository.existsByTraineeEmployee_UserIdAndSkill_IdAndStatus(
                actor.getUserId(), skill.getId(), MentoringMatchRequestStatus.OPEN)) {
            throw new BusinessException(
                    "OPEN_MENTORING_MATCH_REQUEST_EXISTS",
                    "You already have an open HR matching request for this skill.",
                    HttpStatus.CONFLICT
            );
        }
        String message = input.message() == null || input.message().isBlank() ? null : input.message().trim();
        MentoringMatchRequest request = new MentoringMatchRequest();
        request.setTraineeEmployee(employee);
        request.setSkill(skill);
        request.setMessage(message);
        MentoringMatchRequest saved = matchRequestRepository.save(request);
        return MentoringMatchRequestDto.from(saved, null);
    }

    @Transactional(readOnly = true)
    public List<MentoringMatchRequestDto> listForEmployee(ApidUserPrincipal actor) {
        return matchRequestRepository.findByTraineeEmployee_UserIdOrderByCreatedAtDesc(actor.getUserId()).stream()
                .map(this::toDto)
                .toList();
    }

    @Transactional(readOnly = true)
    public List<MentoringMatchRequestDto> listForHr() {
        return matchRequestRepository.findAllByOrderByCreatedAtDesc().stream()
                .map(this::toDto)
                .toList();
    }

    @Transactional(readOnly = true)
    public List<MentoringReassignmentCandidateDto> listReassignmentQueue() {
        return relationshipRepository.findByStatusOrderByStartedAtDesc(MentoringRelationshipStatus.PAUSED).stream()
                .map(relationship -> {
                    List<MentoringRelationshipMember> activeMembers = memberRepository
                            .findByRelationship_IdOrderByJoinedAtAsc(relationship.getId()).stream()
                            .filter(member -> member.getStatus() == MentoringRelationshipMemberStatus.ACTIVE)
                            .toList();
                    Map<Long, Employee> employeesByUserId = activeMembers.isEmpty()
                            ? Map.of()
                            : employeeRepository.findDetailedByUserIdIn(
                                            activeMembers.stream().map(member -> member.getTraineeUser().getId()).toList())
                                    .stream()
                                    .collect(java.util.stream.Collectors.toMap(Employee::getUserId, employee -> employee));
                    String formerTrainerName = employeeRepository
                            .findDetailedByUserId(relationship.getMentorUser().getId())
                            .map(Employee::getFullName)
                            .orElse(relationship.getMentorUser().getUsername());
                    return new MentoringReassignmentCandidateDto(
                            relationship.getId(),
                            relationship.getMentorUser().getId(),
                            formerTrainerName,
                            relationship.getRequest().getSkill() == null
                                    ? null : relationship.getRequest().getSkill().getId(),
                            relationship.getRequest().getSkill() == null
                                    ? null : relationship.getRequest().getSkill().getName(),
                            relationship.getRequest().getRequestType(),
                            relationship.getStartedAt(),
                            activeMembers.stream()
                                    .map(member -> new MentoringReassignmentCandidateDto.Trainee(
                                            member.getTraineeUser().getId(),
                                            employeesByUserId.containsKey(member.getTraineeUser().getId())
                                                    ? employeesByUserId.get(member.getTraineeUser().getId()).getFullName()
                                                    : member.getTraineeUser().getUsername()
                                    ))
                                    .toList()
                    );
                })
                .filter(candidate -> !candidate.trainees().isEmpty())
                .toList();
    }

    @Transactional
    @CacheEvict(cacheNames = "hr_mentor_recommendations_v2", key = "#p0")
    public MentoringMatchRequestDto match(
            Long matchRequestId,
            MentoringMatchAssignmentInput input,
            ApidUserPrincipal actor
    ) {
        MentoringMatchRequest matchRequest = matchRequestRepository.findByIdForUpdate(matchRequestId)
                .orElseThrow(() -> new ResourceNotFoundException("HR mentoring request not found"));
        if (matchRequest.getStatus() != MentoringMatchRequestStatus.OPEN) {
            throw new BusinessException(
                    "MENTORING_MATCH_REQUEST_ALREADY_HANDLED",
                    "This HR mentoring request is no longer open.",
                    HttpStatus.CONFLICT
            );
        }

        User trainer = userRepository.findByIdForUpdate(input.trainerUserId())
                .filter(user -> user.getStatus() == UserStatus.ACTIVE)
                .orElseThrow(() -> new ResourceNotFoundException("Active trainer account not found"));
        ensureAcceptingNewPairings(trainer.getId());
        TrainerAuthorization authorization = trainerAuthorizationRepository.findActiveByUserId(trainer.getId())
                .stream().findFirst()
                .orElseThrow(() -> new BusinessException(
                        "ACTIVE_TRAINER_AUTHORIZATION_REQUIRED",
                        "Only an active trainer can be assigned to an HR matching request.",
                        HttpStatus.CONFLICT
                ));
        boolean hasSkill = authorization.getSkills().stream()
                .anyMatch(skill -> skill.getId().equals(matchRequest.getSkill().getId()) && skill.isActive())
                && skillStatusRepository.existsByAuthorization_IdAndSkill_IdAndStatus(
                        authorization.getId(), matchRequest.getSkill().getId(), TrainerAuthorizationStatus.ACTIVE);
        if (!hasSkill) {
            throw new BusinessException(
                    "TRAINER_SKILL_MISMATCH",
                    "The selected trainer is not authorized for the requested skill.",
                    HttpStatus.CONFLICT
            );
        }
        Employee traineeEmployee = matchRequest.getTraineeEmployee();
        if (traineeEmployee.getUserId() == null
                || traineeEmployee.getEmploymentStatus() != EmploymentStatus.ACTIVE
                || userRepository.findById(traineeEmployee.getUserId())
                .filter(user -> user.getStatus() == UserStatus.ACTIVE).isEmpty()) {
            throw new BusinessException(
                    "INACTIVE_MATCH_REQUEST_TRAINEE",
                    "The requesting employee is no longer active.",
                    HttpStatus.CONFLICT
            );
        }
        long activeTrainees = relationshipRepository.countActiveTraineesByMentorUserId(
                trainer.getId(), MentoringRelationshipStatus.ACTIVE);
        long pendingInvitations = recipientRepository.countByMentorAndStatus(
                trainer.getId(), MentoringRequestRecipientStatus.PENDING);
        boolean capacityReached =
                activeTrainees + pendingInvitations >= authorization.getMaxConcurrentTrainees();
        String overrideReason = input.overrideReason() == null ? null : input.overrideReason().trim();
        if (capacityReached && !input.overrideCapacity()) {
            throw new BusinessException(
                    "MENTOR_CAPACITY_REACHED",
                    "The selected trainer has no remaining capacity.",
                    HttpStatus.CONFLICT
            );
        }
        if (input.overrideCapacity() && (overrideReason == null || overrideReason.isBlank())) {
            throw new BusinessException(
                    "CAPACITY_OVERRIDE_REASON_REQUIRED",
                    "Enter a reason when overriding trainer capacity."
            );
        }
        if (input.overrideCapacity() && !capacityReached) {
            throw new BusinessException(
                    "CAPACITY_OVERRIDE_NOT_NEEDED",
                    "Capacity override is only available when the trainer is at capacity.",
                    HttpStatus.CONFLICT
            );
        }
        if (relationshipRepository.existsActivePair(
                trainer.getId(), traineeEmployee.getUserId(), matchRequest.getSkill().getId(),
                MentoringRelationshipStatus.ACTIVE)
                || recipientRepository.existsByMentorTraineeAndStatus(
                trainer.getId(), traineeEmployee.getUserId(), matchRequest.getSkill().getId(),
                MentoringRequestRecipientStatus.PENDING)) {
            throw new BusinessException(
                    "MENTORING_RELATIONSHIP_EXISTS",
                    "The selected trainer already has a relationship or pending request with this employee for this skill.",
                    HttpStatus.CONFLICT
            );
        }

        User trainee = userRepository.findByIdForUpdate(traineeEmployee.getUserId())
                .orElseThrow(() -> new ResourceNotFoundException("Trainee account not found"));
        MentoringRequest mentoringRequest = new MentoringRequest();
        mentoringRequest.setMentorUser(trainer);
        mentoringRequest.setInitiatedByUser(trainee);
        mentoringRequest.setRequestType(MentoringRequestType.INDIVIDUAL);
        mentoringRequest.setSkill(matchRequest.getSkill());
        mentoringRequest.setMessage(matchRequest.getMessage());
        MentoringRequest savedRequest = mentoringRequestRepository.save(mentoringRequest);

        MentoringRequestRecipient recipient = new MentoringRequestRecipient();
        recipient.setRequest(savedRequest);
        recipient.setRecipientUser(trainee);
        recipient.setTraineeUser(trainee);
        recipient.setStatus(MentoringRequestRecipientStatus.ACCEPTED);
        recipient.setRespondedAt(Instant.now());
        MentoringRequestRecipient savedRecipient = recipientRepository.save(recipient);

        MentoringRelationship relationship = new MentoringRelationship();
        relationship.setRequest(savedRequest);
        relationship.setMentorUser(trainer);
        relationship.setStatus(MentoringRelationshipStatus.ACTIVE);
        MentoringRelationship savedRelationship = relationshipRepository.save(relationship);

        MentoringRelationshipMember member = new MentoringRelationshipMember();
        member.setRelationship(savedRelationship);
        member.setRequestRecipient(savedRecipient);
        member.setMentorUser(trainer);
        member.setTraineeUser(trainee);
        member.setSkill(matchRequest.getSkill());
        member.setStatus(MentoringRelationshipMemberStatus.ACTIVE);
        memberRepository.save(member);

        User matchingAdmin = userRepository.findById(actor.getUserId())
                .orElseThrow(() -> new ResourceNotFoundException("HR account not found"));
        matchRequest.setStatus(MentoringMatchRequestStatus.MATCHED);
        matchRequest.setMatchedTrainer(trainer);
        matchRequest.setMatchedBy(matchingAdmin);
        matchRequest.setMentoringRequest(savedRequest);
        MentoringMatchRequest saved = matchRequestRepository.save(matchRequest);

        notify(trainee.getId(), "MENTORING_HR_MATCHED", "A mentor has been matched",
                "HR matched you with " + authorization.getEmployee().getFullName()
                        + " for " + matchRequest.getSkill().getName() + ".",
                "/mentoring?view=trainee");
        notify(trainer.getId(), "MENTORING_HR_MATCHED", "A trainee has been matched",
                traineeEmployee.getFullName() + " has been matched with you for " + matchRequest.getSkill().getName() + ".",
                "/mentoring?view=trainer");
        Map<String, Object> auditDetails = new java.util.LinkedHashMap<>();
        auditDetails.put("trainerUserId", trainer.getId());
        auditDetails.put("relationshipId", savedRelationship.getId());
        auditDetails.put("capacityOverride", input.overrideCapacity());
        if (input.overrideCapacity()) {
            auditDetails.put("overrideReason", overrideReason);
        }
        auditService.record(new AuditService.AuditCommand(
                null,
                actor.getUserId(),
                actor.getUsername(),
                trainee.getId(),
                "MENTORING",
                "MENTORING_HR_MATCHED",
                "SUCCESS",
                null,
                "MENTORING_MATCH_REQUEST",
                String.valueOf(saved.getId()),
                auditDetails,
                null,
                null
        ));
        return toDto(saved);
    }

    @Transactional
    public MentoringDirectMatchResultDto directMatch(
            MentoringDirectMatchInput input,
            ApidUserPrincipal actor
    ) {
        if (!actor.getPermissions().contains("MENTORING_MATCH_MANAGE")) {
            throw new AccessDeniedException("Only authorized HR can create mentoring matches.");
        }
        if (input.mentorUserId().equals(input.traineeUserId())) {
            throw new BusinessException("SELF_MENTORING_MATCH", "An employee cannot be matched with themselves.");
        }

        User mentor = userRepository.findByIdForUpdate(input.mentorUserId())
                .filter(user -> user.getStatus() == UserStatus.ACTIVE)
                .orElseThrow(() -> new ResourceNotFoundException("Active mentor account not found"));
        ensureAcceptingNewPairings(mentor.getId());
        TrainerAuthorization authorization = trainerAuthorizationRepository.findActiveByUserId(mentor.getId())
                .stream().findFirst()
                .orElseThrow(() -> new BusinessException(
                        "ACTIVE_TRAINER_AUTHORIZATION_REQUIRED",
                        "Only an active, authorized mentor can be assigned.",
                        HttpStatus.CONFLICT
                ));
        if (authorization.getEmployee().getEmploymentStatus() != EmploymentStatus.ACTIVE) {
            throw new BusinessException(
                    "INACTIVE_TRAINER_CANDIDATE",
                    "Only an active employee can be assigned as a mentor.",
                    HttpStatus.CONFLICT
            );
        }
        Skill skill = skillRepository.findByIdAndActiveTrue(input.skillId())
                .orElseThrow(() -> new ResourceNotFoundException("Active skill not found"));
        if (!authorization.getSkills().stream()
                .anyMatch(candidate -> candidate.getId().equals(skill.getId()) && candidate.isActive())
                || !skillStatusRepository.existsByAuthorization_IdAndSkill_IdAndStatus(
                authorization.getId(), skill.getId(), TrainerAuthorizationStatus.ACTIVE)) {
            throw new BusinessException(
                    "TRAINER_SKILL_MISMATCH",
                    "The selected mentor is not authorized for this skill.",
                    HttpStatus.CONFLICT
            );
        }
        User trainee = userRepository.findByIdForUpdate(input.traineeUserId())
                .filter(user -> user.getStatus() == UserStatus.ACTIVE)
                .orElseThrow(() -> new ResourceNotFoundException("Active trainee account not found"));
        Employee traineeEmployee = employeeRepository.findDetailedByUserId(trainee.getId())
                .filter(employee -> employee.getEmploymentStatus() == EmploymentStatus.ACTIVE)
                .orElseThrow(() -> new BusinessException(
                        "ACTIVE_TRAINEE_REQUIRED",
                        "Only an active employee can be matched as a trainee.",
                        HttpStatus.CONFLICT
                ));

        if (relationshipRepository.existsActivePair(
                mentor.getId(), trainee.getId(), skill.getId(), MentoringRelationshipStatus.ACTIVE)) {
            throw new BusinessException(
                    "MENTORING_RELATIONSHIP_EXISTS",
                    "The selected mentor and trainee already have an active relationship for this skill.",
                    HttpStatus.CONFLICT
            );
        }
        if (recipientRepository.existsByMentorTraineeAndStatus(
                mentor.getId(), trainee.getId(), skill.getId(), MentoringRequestRecipientStatus.PENDING)) {
            throw new BusinessException(
                    "MENTORING_PAIR_REQUEST_PENDING",
                    "A pending mentoring request already exists for this mentor and trainee for this skill.",
                    HttpStatus.CONFLICT
            );
        }

        long activeTrainees = relationshipRepository.countActiveTraineesByMentorUserId(
                mentor.getId(), MentoringRelationshipStatus.ACTIVE);
        long pendingInvitations = recipientRepository.countByMentorAndStatus(
                mentor.getId(), MentoringRequestRecipientStatus.PENDING);
        if (activeTrainees + pendingInvitations >= authorization.getMaxConcurrentTrainees()) {
            throw new BusinessException(
                    "MENTOR_CAPACITY_REACHED",
                    "The selected mentor has no remaining capacity.",
                    HttpStatus.CONFLICT
            );
        }

        User hrUser = userRepository.findById(actor.getUserId())
                .orElseThrow(() -> new ResourceNotFoundException("HR account not found"));
        MentoringRequest request = new MentoringRequest();
        request.setMentorUser(mentor);
        request.setInitiatedByUser(hrUser);
        request.setRequestType(MentoringRequestType.INDIVIDUAL);
        request.setSkill(skill);
        MentoringRequest savedRequest = mentoringRequestRepository.save(request);

        MentoringRequestRecipient recipient = new MentoringRequestRecipient();
        recipient.setRequest(savedRequest);
        recipient.setRecipientUser(trainee);
        recipient.setTraineeUser(trainee);
        recipient.setStatus(MentoringRequestRecipientStatus.ACCEPTED);
        recipient.setRespondedAt(Instant.now());
        recipientRepository.save(recipient);

        MentoringRelationship relationship = new MentoringRelationship();
        relationship.setRequest(savedRequest);
        relationship.setMentorUser(mentor);
        relationship.setStatus(MentoringRelationshipStatus.ACTIVE);
        MentoringRelationship savedRelationship = relationshipRepository.save(relationship);

        MentoringRelationshipMember member = new MentoringRelationshipMember();
        member.setRelationship(savedRelationship);
        member.setRequestRecipient(recipient);
        member.setMentorUser(mentor);
        member.setTraineeUser(trainee);
        member.setSkill(skill);
        member.setStatus(MentoringRelationshipMemberStatus.ACTIVE);
        memberRepository.save(member);

        String mentorName = authorization.getEmployee().getFullName();
        String pairingLink = "/mentoring/pairing/" + savedRelationship.getId();
        notify(trainee.getId(), "MENTORING_HR_MATCHED", "A mentor has been matched",
                "HR matched you with " + mentorName + " for " + skill.getName() + ".", pairingLink);
        notify(mentor.getId(), "MENTORING_HR_MATCHED", "A trainee has been matched",
                traineeEmployee.getFullName() + " has been matched with you for " + skill.getName() + " by HR.",
                pairingLink);

        Map<String, Object> auditDetails = new LinkedHashMap<>();
        auditDetails.put("mentorUserId", mentor.getId());
        auditDetails.put("traineeUserId", trainee.getId());
        auditDetails.put("relationshipId", savedRelationship.getId());
        auditDetails.put("skillId", skill.getId());
        auditService.record(new AuditService.AuditCommand(
                null,
                actor.getUserId(),
                actor.getUsername(),
                trainee.getId(),
                "MENTORING",
                "MENTORING_HR_DIRECT_MATCHED",
                "SUCCESS",
                null,
                "MENTORING_RELATIONSHIP",
                String.valueOf(savedRelationship.getId()),
                auditDetails,
                null,
                null
        ));
        return new MentoringDirectMatchResultDto(
                savedRelationship.getId(),
                mentor.getId(),
                mentorName,
                trainee.getId(),
                traineeEmployee.getFullName(),
                savedRelationship.getStartedAt()
        );
    }

    @Transactional
    public MentoringReassignmentResultDto reassign(
            Long relationshipId,
            MentoringReassignmentInput input,
            ApidUserPrincipal actor
    ) {
        if (!actor.getPermissions().contains("MENTORING_MATCH_MANAGE")
                && !actor.getPermissions().contains("TRAINER_STATUS_MANAGE")) {
            throw new AccessDeniedException("Only authorized HR can reassign mentoring relationships.");
        }
        MentoringRelationship previousRelationship = relationshipRepository.findByIdForUpdate(relationshipId)
                .orElseThrow(() -> new ResourceNotFoundException("Mentoring relationship not found"));
        if (previousRelationship.getStatus() != MentoringRelationshipStatus.PAUSED) {
            throw new BusinessException(
                    "MENTORING_RELATIONSHIP_NOT_PAUSED",
                    "Only paused mentoring relationships can be reassigned.",
                    HttpStatus.CONFLICT
            );
        }
        List<MentoringRelationshipMember> previousMembers = memberRepository
                .findByRelationship_IdOrderByJoinedAtAsc(relationshipId).stream()
                .filter(member -> member.getStatus() == MentoringRelationshipMemberStatus.ACTIVE)
                .toList();
        if (previousMembers.isEmpty()) {
            throw new BusinessException(
                    "MENTORING_RELATIONSHIP_NO_ACTIVE_TRAINEES",
                    "This relationship has no active trainees to reassign.",
                    HttpStatus.CONFLICT
            );
        }

        User trainer = userRepository.findByIdForUpdate(input.trainerUserId())
                .filter(user -> user.getStatus() == UserStatus.ACTIVE)
                .orElseThrow(() -> new ResourceNotFoundException("Active trainer account not found"));
        ensureAcceptingNewPairings(trainer.getId());
        if (trainer.getId().equals(previousRelationship.getMentorUser().getId())) {
            throw new BusinessException(
                    "MENTORING_REASSIGNMENT_SAME_TRAINER",
                    "Choose a different trainer for the reassignment.",
                    HttpStatus.CONFLICT
            );
        }
        TrainerAuthorization authorization = trainerAuthorizationRepository.findActiveByUserId(trainer.getId())
                .stream().findFirst()
                .orElseThrow(() -> new BusinessException(
                        "ACTIVE_TRAINER_AUTHORIZATION_REQUIRED",
                        "Only an active trainer can receive a reassigned relationship.",
                        HttpStatus.CONFLICT
                ));
        Long relationshipSkillId = previousRelationship.getRequest().getSkill() == null
                ? null : previousRelationship.getRequest().getSkill().getId();
        boolean hasSkill = relationshipSkillId != null && authorization.getSkills().stream()
                .anyMatch(skill -> skill.getId().equals(relationshipSkillId));
        if (hasSkill) {
            boolean catalogSkillActive = authorization.getSkills().stream()
                    .filter(skill -> skill.getId().equals(relationshipSkillId))
                    .anyMatch(Skill::isActive);
            if (!catalogSkillActive) {
                throw new BusinessException(
                        "TRAINER_SKILL_NOT_ACTIVE",
                        "The selected skill is no longer active in the skill catalog.",
                        HttpStatus.CONFLICT
                );
            }
            TrainerAuthorizationStatus skillStatus = skillStatusRepository
                    .findByAuthorization_IdAndSkill_Id(authorization.getId(), relationshipSkillId)
                    .orElseThrow(() -> new BusinessException(
                            "TRAINER_SKILL_STATUS_MISSING",
                            "The selected trainer's authorization status for this skill is unavailable.",
                            HttpStatus.CONFLICT
                    ))
                    .getStatus();
            if (skillStatus != TrainerAuthorizationStatus.ACTIVE) {
                throw new BusinessException(
                        "TRAINER_SKILL_NOT_ACTIVE",
                        "The selected trainer's authorization for this skill is suspended or revoked.",
                        HttpStatus.CONFLICT
                );
            }
        }
        boolean skillMismatch = relationshipSkillId != null && !hasSkill;
        if (!employeeRepository.existsByUserIdAndEmploymentStatus(trainer.getId(), EmploymentStatus.ACTIVE)) {
            throw new BusinessException(
                    "INACTIVE_TRAINER_CANDIDATE",
                    "Only an active employee can receive a reassigned relationship.",
                    HttpStatus.CONFLICT
            );
        }
        for (MentoringRelationshipMember member : previousMembers) {
            if (relationshipRepository.existsActivePair(
                    trainer.getId(), member.getTraineeUser().getId(), relationshipSkillId,
                    MentoringRelationshipStatus.ACTIVE)
                    || recipientRepository.existsByMentorTraineeAndStatus(
                    trainer.getId(), member.getTraineeUser().getId(), relationshipSkillId,
                    MentoringRequestRecipientStatus.PENDING)) {
                throw new BusinessException(
                        "MENTORING_RELATIONSHIP_EXISTS",
                        "The selected trainer already has a relationship or pending request with one of these trainees for this skill.",
                        HttpStatus.CONFLICT
                );
            }
        }

        long activeTrainees = relationshipRepository.countActiveTraineesByMentorUserId(
                trainer.getId(), MentoringRelationshipStatus.ACTIVE);
        long pendingInvitations = recipientRepository.countByMentorAndStatus(
                trainer.getId(), MentoringRequestRecipientStatus.PENDING);
        boolean capacityReached = activeTrainees + pendingInvitations + previousMembers.size()
                > authorization.getMaxConcurrentTrainees();
        String reassignmentReason = input.reason().trim();
        String overrideReason = input.overrideReason() == null ? null : input.overrideReason().trim();
        String skillOverrideReason = input.skillOverrideReason() == null
                ? null : input.skillOverrideReason().trim();
        if (skillMismatch && (skillOverrideReason == null || skillOverrideReason.isBlank())) {
            throw new BusinessException(
                    "SKILL_OVERRIDE_REASON_REQUIRED",
                    "Enter a reason when overriding the trainer skill requirement."
            );
        }
        if (!skillMismatch && skillOverrideReason != null && !skillOverrideReason.isBlank()) {
            throw new BusinessException(
                    "SKILL_OVERRIDE_NOT_NEEDED",
                    "Skill mismatch override is only available when the selected trainer lacks the relationship skill.",
                    HttpStatus.CONFLICT
            );
        }
        if (capacityReached && !input.overrideCapacity()) {
            throw new BusinessException(
                    "MENTOR_CAPACITY_REACHED",
                    "The selected trainer does not have enough capacity for all trainees in this relationship.",
                    HttpStatus.CONFLICT
            );
        }
        if (input.overrideCapacity() && (overrideReason == null || overrideReason.isBlank())) {
            throw new BusinessException(
                    "CAPACITY_OVERRIDE_REASON_REQUIRED",
                    "Enter a reason when overriding trainer capacity."
            );
        }
        if (input.overrideCapacity() && !capacityReached) {
            throw new BusinessException(
                    "CAPACITY_OVERRIDE_NOT_NEEDED",
                    "Capacity override is only available when the selected trainer lacks capacity.",
                    HttpStatus.CONFLICT
            );
        }

        User hrUser = userRepository.findById(actor.getUserId())
                .orElseThrow(() -> new ResourceNotFoundException("HR account not found"));
        MentoringRequest reassignmentRequest = new MentoringRequest();
        reassignmentRequest.setMentorUser(trainer);
        reassignmentRequest.setInitiatedByUser(hrUser);
        reassignmentRequest.setRequestType(previousRelationship.getRequest().getRequestType());
        reassignmentRequest.setSkill(previousRelationship.getRequest().getSkill());
        reassignmentRequest.setMessage(reassignmentReason);
        MentoringRequest savedRequest = mentoringRequestRepository.save(reassignmentRequest);

        MentoringRelationship newRelationship = new MentoringRelationship();
        newRelationship.setRequest(savedRequest);
        newRelationship.setMentorUser(trainer);
        newRelationship.setStatus(MentoringRelationshipStatus.ACTIVE);
        MentoringRelationship savedRelationship = relationshipRepository.save(newRelationship);

        Instant now = Instant.now();
        List<MentoringRequestRecipient> recipients = new ArrayList<>();
        List<MentoringRelationshipMember> newMembers = new ArrayList<>();
        for (MentoringRelationshipMember previousMember : previousMembers) {
            MentoringRequestRecipient recipient = new MentoringRequestRecipient();
            recipient.setRequest(savedRequest);
            recipient.setRecipientUser(previousMember.getTraineeUser());
            recipient.setTraineeUser(previousMember.getTraineeUser());
            recipient.setStatus(MentoringRequestRecipientStatus.ACCEPTED);
            recipient.setRespondedAt(now);
            recipients.add(recipient);
        }
        recipients = recipientRepository.saveAll(recipients);
        for (MentoringRequestRecipient recipient : recipients) {
            MentoringRelationshipMember member = new MentoringRelationshipMember();
            member.setRelationship(savedRelationship);
            member.setRequestRecipient(recipient);
            member.setMentorUser(trainer);
            member.setTraineeUser(recipient.getTraineeUser());
            member.setSkill(savedRequest.getSkill());
            member.setStatus(MentoringRelationshipMemberStatus.ACTIVE);
            newMembers.add(member);
        }
        memberRepository.saveAll(newMembers);

        previousRelationship.setStatus(MentoringRelationshipStatus.REASSIGNED);
        previousRelationship.setEndedAt(now);
        relationshipRepository.save(previousRelationship);
        previousMembers.forEach(member -> {
            member.setStatus(MentoringRelationshipMemberStatus.COMPLETED);
            member.setEndedAt(now);
        });
        memberRepository.saveAll(previousMembers);

        String trainerName = authorization.getEmployee().getFullName();
        for (MentoringRelationshipMember member : previousMembers) {
            notify(member.getTraineeUser().getId(), "MENTORING_RELATIONSHIP_REASSIGNED",
                    "Your mentoring relationship has been reassigned",
                    "HR matched you with " + trainerName + ".",
                    "/mentoring/pairing/" + savedRelationship.getId());
        }
        notify(trainer.getId(), "MENTORING_RELATIONSHIP_REASSIGNED",
                "A mentoring relationship was reassigned to you",
                previousMembers.size() + " trainee(s) were reassigned to you by HR.",
                "/mentoring/pairing/" + savedRelationship.getId());

        Map<String, Object> auditDetails = new LinkedHashMap<>();
        auditDetails.put("previousRelationshipId", relationshipId);
        auditDetails.put("newRelationshipId", savedRelationship.getId());
        auditDetails.put("formerTrainerUserId", previousRelationship.getMentorUser().getId());
        auditDetails.put("trainerUserId", trainer.getId());
        auditDetails.put("traineeCount", previousMembers.size());
        auditDetails.put("reason", reassignmentReason);
        auditDetails.put("capacityOverride", input.overrideCapacity());
        auditDetails.put("skillMismatchOverride", skillMismatch);
        if (input.overrideCapacity()) {
            auditDetails.put("overrideReason", overrideReason);
        }
        if (skillMismatch) {
            auditDetails.put("skillOverrideReason", skillOverrideReason);
        }
        auditService.record(new AuditService.AuditCommand(
                null,
                actor.getUserId(),
                actor.getUsername(),
                trainer.getId(),
                "MENTORING",
                "MENTORING_RELATIONSHIP_REASSIGNED",
                "SUCCESS",
                null,
                "MENTORING_RELATIONSHIP",
                String.valueOf(relationshipId),
                auditDetails,
                null,
                null
        ));
        return new MentoringReassignmentResultDto(
                relationshipId,
                savedRelationship.getId(),
                trainer.getId(),
                trainerName,
                previousMembers.size()
        );
    }

    private void ensureAcceptingNewPairings(Long mentorUserId) {
        if (!availabilityService.isAcceptingNewPairings(mentorUserId)) {
            throw new BusinessException(
                    "MENTOR_NOT_ACCEPTING_NEW_PAIRINGS",
                    "This mentor is not accepting new mentoring pairings.",
                    HttpStatus.CONFLICT
            );
        }
    }

    private MentoringMatchRequestDto toDto(MentoringMatchRequest request) {
        Long relationshipId = request.getMentoringRequest() == null
                ? null
                : relationshipRepository.findByRequest_Id(request.getMentoringRequest().getId())
                .map(MentoringRelationship::getId)
                .orElse(null);
        String matchedTrainerName = request.getMatchedTrainer() == null
                ? null
                : employeeRepository.findDetailedByUserId(request.getMatchedTrainer().getId())
                        .map(Employee::getFullName)
                        .orElse(request.getMatchedTrainer().getUsername());
        return MentoringMatchRequestDto.from(request, relationshipId, matchedTrainerName);
    }

    private void notify(Long userId, String event, String title, String message, String deepLink) {
        notificationService.notify(userId, NotificationModule.MENTORING, event, title, message, deepLink);
    }
}
