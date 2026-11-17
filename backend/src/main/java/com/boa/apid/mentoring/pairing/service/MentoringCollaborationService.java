package com.boa.apid.mentoring.pairing.service;

import com.boa.apid.coaching.session.dto.SessionJoinTokenDto;
import com.boa.apid.coaching.session.video.MeetingRoomDetails;
import com.boa.apid.coaching.session.video.MeetingTokenDetails;
import com.boa.apid.coaching.session.video.VideoMeetingProvider;
import com.boa.apid.common.exception.BusinessException;
import com.boa.apid.common.exception.ResourceNotFoundException;
import com.boa.apid.core.auth.security.ApidUserPrincipal;
import com.boa.apid.core.authorization.entity.User;
import com.boa.apid.core.authorization.repository.UserRepository;
import com.boa.apid.core.authorization.repository.UserRoleRepository;
import com.boa.apid.core.organization.entity.Employee;
import com.boa.apid.core.organization.entity.EmploymentStatus;
import com.boa.apid.core.organization.repository.EmployeeRepository;
import com.boa.apid.core.scheduling.dto.AvailabilityCheckRequest;
import com.boa.apid.core.scheduling.dto.AvailabilityCheckResponse;
import com.boa.apid.core.scheduling.dto.CreateReservationCommand;
import com.boa.apid.core.scheduling.entity.ParticipationRole;
import com.boa.apid.core.scheduling.service.ScheduleReservationService;
import com.boa.apid.mentoring.pairing.dto.*;
import com.boa.apid.mentoring.pairing.entity.MentoringDeliveryMode;
import com.boa.apid.mentoring.pairing.entity.MentoringMessage;
import com.boa.apid.mentoring.pairing.entity.MentoringRelationship;
import com.boa.apid.mentoring.pairing.entity.MentoringRelationshipMember;
import com.boa.apid.mentoring.pairing.entity.MentoringRelationshipMemberStatus;
import com.boa.apid.mentoring.pairing.entity.MentoringRelationshipStatus;
import com.boa.apid.mentoring.pairing.entity.MentoringSession;
import com.boa.apid.mentoring.pairing.entity.MentoringSessionStatus;
import com.boa.apid.mentoring.pairing.repository.MentoringMessageRepository;
import com.boa.apid.mentoring.pairing.repository.MentoringRelationshipMemberRepository;
import com.boa.apid.mentoring.pairing.repository.MentoringRelationshipRepository;
import com.boa.apid.mentoring.pairing.repository.MentoringSessionRepository;
import com.boa.apid.mentoring.trainer.repository.TrainerAuthorizationRepository;
import com.boa.apid.mentoring.trainer.entity.TrainerAuthorizationStatus;
import com.boa.apid.mentoring.trainer.repository.TrainerAuthorizationSkillStatusRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.net.URI;
import java.time.DayOfWeek;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

@Service
public class MentoringCollaborationService {

    private static final Logger log = LoggerFactory.getLogger(MentoringCollaborationService.class);

    private static final int MAX_MESSAGE_LENGTH = 4000;
    private static final int MAX_CHAT_PAGE_SIZE = 100;
    private static final int MAX_CHAT_PAGE_INDEX = 10000;

    private final MentoringRelationshipRepository relationshipRepository;
    private final MentoringRelationshipMemberRepository memberRepository;
    private final MentoringSessionRepository sessionRepository;
    private final MentoringMessageRepository messageRepository;
    private final EmployeeRepository employeeRepository;
    private final UserRepository userRepository;
    private final UserRoleRepository userRoleRepository;
    private final TrainerAuthorizationRepository trainerAuthorizationRepository;
    private final TrainerAuthorizationSkillStatusRepository skillStatusRepository;
    private final ScheduleReservationService reservationService;
    private final VideoMeetingProvider videoMeetingProvider;

    public MentoringCollaborationService(
            MentoringRelationshipRepository relationshipRepository,
            MentoringRelationshipMemberRepository memberRepository,
            MentoringSessionRepository sessionRepository,
            MentoringMessageRepository messageRepository,
            EmployeeRepository employeeRepository,
            UserRepository userRepository,
            UserRoleRepository userRoleRepository,
            TrainerAuthorizationRepository trainerAuthorizationRepository,
            TrainerAuthorizationSkillStatusRepository skillStatusRepository,
            ScheduleReservationService reservationService,
            VideoMeetingProvider videoMeetingProvider
    ) {
        this.relationshipRepository = relationshipRepository;
        this.memberRepository = memberRepository;
        this.sessionRepository = sessionRepository;
        this.messageRepository = messageRepository;
        this.employeeRepository = employeeRepository;
        this.userRepository = userRepository;
        this.userRoleRepository = userRoleRepository;
        this.trainerAuthorizationRepository = trainerAuthorizationRepository;
        this.skillStatusRepository = skillStatusRepository;
        this.reservationService = reservationService;
        this.videoMeetingProvider = videoMeetingProvider;
    }

    @Transactional(readOnly = true)
    public MentoringPairingDetailDto getPairingDetail(Long relationshipId, ApidUserPrincipal actor) {
        MentoringRelationship relationship = requireRelationshipAccess(relationshipId, actor.getUserId());
        List<MentoringRelationshipMember> members =
                memberRepository.findByRelationship_IdOrderByJoinedAtAsc(relationshipId);

        Set<Long> userIds = new LinkedHashSet<>();
        userIds.add(relationship.getMentorUser().getId());
        members.forEach(member -> userIds.add(member.getTraineeUser().getId()));
        Map<Long, Employee> employeesByUserId = loadEmployees(userIds);

        return new MentoringPairingDetailDto(
                relationship.getId(),
                relationship.getRequest().getId(),
                relationship.getRequest().getRequestType(),
                relationship.getStatus(),
                relationship.getMentorUser().getId(),
                employeeName(relationship.getMentorUser().getId(), relationship.getMentorUser().getUsername(), employeesByUserId),
                relationship.getRequest().getSkill() == null
                        ? null
                        : relationship.getRequest().getSkill().getName(),
                relationship.getRequest().getMessage(),
                relationship.getStartedAt(),
                relationship.getEndedAt(),
                relationship.getMentorUser().getId().equals(actor.getUserId())
                        ? MentoringRelationshipPairDto.ParticipantRole.MENTOR
                        : MentoringRelationshipPairDto.ParticipantRole.TRAINEE,
                members.stream()
                        .map(member -> new MentoringPairingDetailDto.Trainee(
                                member.getTraineeUser().getId(),
                                employeeName(
                                        member.getTraineeUser().getId(),
                                        member.getTraineeUser().getUsername(),
                                        employeesByUserId
                                ),
                                member.getStatus(),
                                member.getJoinedAt(),
                                member.getEndedAt()
                        ))
                        .toList()
        );
    }

    @Transactional(readOnly = true)
    public List<MentoringSessionDto> listSessions(Long relationshipId, ApidUserPrincipal actor) {
        requireRelationshipAccess(relationshipId, actor.getUserId());
        List<MentoringSession> sessions =
                sessionRepository.findByRelationship_IdOrderByScheduledStartDesc(relationshipId);
        Map<Long, Employee> employeesByUserId = loadEmployees(
                sessions.stream().map(session -> session.getCreatedByUser().getId()).toList()
        );
        return sessions.stream()
                .map(session -> toSessionDto(session, employeesByUserId))
                .toList();
    }

    @Transactional(readOnly = true)
    public List<MentoringSessionDto> listMySessions(ApidUserPrincipal actor) {
        List<Long> relationshipIds = memberRepository.findVisibleToUser(actor.getUserId()).stream()
                .map(member -> member.getRelationship().getId())
                .distinct()
                .toList();
        if (relationshipIds.isEmpty()) {
            return List.of();
        }

        List<MentoringSession> sessions =
                sessionRepository.findByRelationship_IdInOrderByScheduledStartDesc(relationshipIds);
        Map<Long, Employee> employeesByUserId = loadEmployees(
                sessions.stream().map(session -> session.getCreatedByUser().getId()).toList()
        );
        return sessions.stream()
                .map(session -> toSessionDto(session, employeesByUserId))
                .toList();
    }

    @Transactional
    public MentoringSessionDto createSession(
            Long relationshipId,
            MentoringSessionRequest body,
            ApidUserPrincipal actor
    ) {
        MentoringRelationship relationship = requireRelationshipAccess(relationshipId, actor.getUserId());
        if (!relationship.getMentorUser().getId().equals(actor.getUserId())) {
            throw new AccessDeniedException("Only the mentor can schedule a session.");
        }
        var activeAuthorizations = trainerAuthorizationRepository.findActiveByUserId(actor.getUserId());
        if (!userRoleRepository.existsActiveMentorRoleByUserId(actor.getUserId())
                || activeAuthorizations.isEmpty()
                || !employeeRepository.existsByUserIdAndEmploymentStatus(actor.getUserId(), EmploymentStatus.ACTIVE)) {
            throw new AccessDeniedException("Only an active mentor can schedule a session.");
        }
        Long skillId = relationship.getRequest().getSkill() == null
                ? null : relationship.getRequest().getSkill().getId();
        boolean skillAuthorizationInactive = skillId != null && skillStatusRepository
                .findByAuthorization_IdAndSkill_Id(activeAuthorizations.get(0).getId(), skillId)
                .map(skillStatus -> skillStatus.getStatus() != TrainerAuthorizationStatus.ACTIVE)
                .orElse(false);
        if (skillId != null && (!relationship.getRequest().getSkill().isActive() || skillAuthorizationInactive)) {
            throw new BusinessException(
                    "MENTOR_SKILL_NOT_ACTIVE",
                    "Sessions cannot be scheduled because the mentor's authorization for this skill is suspended or revoked.",
                    HttpStatus.CONFLICT
            );
        }
        if (relationship.getStatus() != MentoringRelationshipStatus.ACTIVE) {
            throw new BusinessException(
                    "MENTORING_RELATIONSHIP_NOT_ACTIVE",
                    "Sessions can only be scheduled for an active mentoring relationship.",
                    HttpStatus.CONFLICT
            );
        }
        validateSession(body);

        String meetingUrl = normalizeMeetingUrl(body.meetingUrl());
        if ((body.deliveryMode() == MentoringDeliveryMode.ONLINE || body.deliveryMode() == MentoringDeliveryMode.HYBRID)
                && (meetingUrl == null || meetingUrl.isBlank())) {
            try {
                String prefix = "mentoring-rel" + relationship.getId();
                Instant expiry = body.scheduledEnd().plus(Duration.ofHours(3));
                MeetingRoomDetails room = videoMeetingProvider.createRoom(prefix, expiry);
                meetingUrl = room.roomUrl();
            } catch (Exception ex) {
                log.warn("Failed to provision Daily.co video room for mentoring session, using fallback", ex);
                meetingUrl = "https://amakari.daily.co/boa-mentoring-rel" + relationship.getId();
            }
        }

        MentoringSession session = new MentoringSession();
        session.setRelationship(relationship);
        session.setTitle(body.title().trim());
        session.setAgenda(normalizeOptionalText(body.agenda()));
        session.setScheduledStart(body.scheduledStart());
        session.setScheduledEnd(body.scheduledEnd());
        session.setDeliveryMode(body.deliveryMode());
        session.setMeetingUrl(meetingUrl);
        session.setLocation(normalizeOptionalText(body.location()));
        session.setStatus(MentoringSessionStatus.SCHEDULED);
        session.setCreatedByUser(relationship.getMentorUser());

        MentoringSession saved = sessionRepository.save(session);

        // Register central reservation & enforce cross-module conflict check
        List<CreateReservationCommand.ParticipantReservationInput> participants = getReservationParticipants(relationship);
        if (participants.isEmpty()) {
            throw new BusinessException("NO_PARTICIPANTS", "No valid employee participants found for this mentoring relationship.", HttpStatus.BAD_REQUEST);
        }
        reservationService.reserve(new CreateReservationCommand(
                "MENTORING",
                saved.getId(),
                saved.getTitle(),
                saved.getScheduledStart(),
                saved.getScheduledEnd(),
                "Africa/Addis_Ababa",
                saved.getDeliveryMode().name(),
                saved.getLocation(),
                saved.getMeetingUrl(),
                participants
        ));

        Map<Long, Employee> employeesByUserId = loadEmployees(List.of(actor.getUserId()));
        return toSessionDto(saved, employeesByUserId);
    }

    @Transactional
    public MentoringSessionDto respondSession(
            Long relationshipId,
            Long sessionId,
            RespondMentoringSessionRequest request,
            ApidUserPrincipal actor
    ) {
        MentoringRelationship relationship = requireRelationshipAccess(relationshipId, actor.getUserId());
        if (!isRelationshipTrainee(relationship, actor.getUserId())) {
            throw new AccessDeniedException("Only the assigned trainee can accept or decline this session invitation.");
        }

        MentoringSession session = sessionRepository.findById(sessionId)
                .orElseThrow(() -> new ResourceNotFoundException("Mentoring session not found."));

        if (!session.getRelationship().getId().equals(relationshipId)) {
            throw new BusinessException("SESSION_MISMATCH", "Session does not belong to this relationship.", HttpStatus.BAD_REQUEST);
        }

        if (session.getStatus() != MentoringSessionStatus.SCHEDULED) {
            throw new BusinessException("INVALID_STATE", "This session is currently " + session.getStatus() + " and cannot be answered.", HttpStatus.BAD_REQUEST);
        }

        session.setRespondedAt(Instant.now());
        if (request.accept()) {
            session.setStatus(MentoringSessionStatus.CONFIRMED);
        } else {
            if (request.declineReason() == null || request.declineReason().isBlank()) {
                throw new BusinessException("DECLINE_REASON_REQUIRED", "Bank policy requires an explanatory reason when declining a scheduled session.", HttpStatus.BAD_REQUEST);
            }
            session.setStatus(MentoringSessionStatus.DECLINED);
            session.setDeclineReason(request.declineReason().trim());
            // Release central reservation
            reservationService.release("MENTORING", session.getId(), "Trainee declined: " + request.declineReason().trim());
        }

        MentoringSession saved = sessionRepository.save(session);
        Map<Long, Employee> employeesByUserId = loadEmployees(List.of(actor.getUserId(), session.getCreatedByUser().getId()));
        return toSessionDto(saved, employeesByUserId);
    }

    @Transactional
    public MentoringSessionDto proposeReschedule(
            Long relationshipId,
            Long sessionId,
            ProposeMentoringRescheduleRequest request,
            ApidUserPrincipal actor
    ) {
        MentoringRelationship relationship = requireRelationshipAccess(relationshipId, actor.getUserId());
        boolean isMentor = relationship.getMentorUser().getId().equals(actor.getUserId());
        boolean isTrainee = isRelationshipTrainee(relationship, actor.getUserId());
        if (!isMentor && !isTrainee) {
            throw new AccessDeniedException("Only relationship participants can propose rescheduling.");
        }

        MentoringSession session = sessionRepository.findById(sessionId)
                .orElseThrow(() -> new ResourceNotFoundException("Mentoring session not found."));

        if (!session.getRelationship().getId().equals(relationshipId)) {
            throw new BusinessException("SESSION_MISMATCH", "Session does not belong to this relationship.", HttpStatus.BAD_REQUEST);
        }

        if (session.getStatus() == MentoringSessionStatus.COMPLETED || session.getStatus() == MentoringSessionStatus.CANCELLED) {
            throw new BusinessException("INVALID_STATE", "Cannot reschedule a completed or cancelled session.", HttpStatus.BAD_REQUEST);
        }

        if (request.proposedStart() == null || request.proposedEnd() == null
                || !request.proposedStart().isAfter(Instant.now())
                || !request.proposedEnd().isAfter(request.proposedStart())) {
            throw new BusinessException("INVALID_MENTORING_SESSION_TIME", "Choose a future proposed start time and end time.", HttpStatus.BAD_REQUEST);
        }

        ZoneId eatZone = ZoneId.of("Africa/Addis_Ababa");
        if (request.proposedStart().atZone(eatZone).getDayOfWeek() == DayOfWeek.SUNDAY) {
            throw new BusinessException("SUNDAY_NOT_ALLOWED", "Bank policy strictly prohibits scheduling sessions on Sundays.", HttpStatus.BAD_REQUEST);
        }

        if (request.reason() == null || request.reason().isBlank()) {
            throw new BusinessException("REASON_REQUIRED", "Bank policy requires an explanatory reason when proposing a new time.", HttpStatus.BAD_REQUEST);
        }

        // Check availability across mentor and trainees
        List<Long> employeeIds = getRelationshipEmployeeIds(relationship);
        AvailabilityCheckResponse check = reservationService.checkAvailability(
                new AvailabilityCheckRequest(employeeIds, request.proposedStart(), request.proposedEnd(), "MENTORING", session.getId())
        );
        if (!check.available()) {
            var first = check.conflicts().get(0);
            throw new BusinessException("SCHEDULE_CONFLICT",
                    first.employeeName() + " has a conflicting " + first.conflictingModule() + " booking (" +
                            first.startAt() + " - " + first.endAt() + ").",
                    HttpStatus.CONFLICT);
        }

        session.setStatus(MentoringSessionStatus.RESCHEDULE_PROPOSED);
        session.setProposedStart(request.proposedStart());
        session.setProposedEnd(request.proposedEnd());
        session.setRescheduleReason(request.reason().trim());
        session.setRespondedAt(Instant.now());

        MentoringSession saved = sessionRepository.save(session);
        Map<Long, Employee> employeesByUserId = loadEmployees(List.of(actor.getUserId(), session.getCreatedByUser().getId()));
        return toSessionDto(saved, employeesByUserId);
    }

    @Transactional
    public MentoringSessionDto respondReschedule(
            Long relationshipId,
            Long sessionId,
            boolean accept,
            ApidUserPrincipal actor
    ) {
        MentoringRelationship relationship = requireRelationshipAccess(relationshipId, actor.getUserId());
        boolean isMentor = relationship.getMentorUser().getId().equals(actor.getUserId());
        if (!isMentor) {
            throw new AccessDeniedException("Only the designated mentor can accept or reject proposed reschedules.");
        }

        MentoringSession session = sessionRepository.findById(sessionId)
                .orElseThrow(() -> new ResourceNotFoundException("Mentoring session not found."));

        if (!session.getRelationship().getId().equals(relationshipId)) {
            throw new BusinessException("SESSION_MISMATCH", "Session does not belong to this relationship.", HttpStatus.BAD_REQUEST);
        }

        if (session.getStatus() != MentoringSessionStatus.RESCHEDULE_PROPOSED) {
            throw new BusinessException("INVALID_STATE", "There is no pending reschedule request for this session.", HttpStatus.BAD_REQUEST);
        }

        if (accept) {
            session.setScheduledStart(session.getProposedStart());
            session.setScheduledEnd(session.getProposedEnd());
            session.setStatus(MentoringSessionStatus.CONFIRMED);
            session.setProposedStart(null);
            session.setProposedEnd(null);
            reservationService.reschedule("MENTORING", session.getId(), session.getScheduledStart(), session.getScheduledEnd());
        } else {
            session.setStatus(MentoringSessionStatus.SCHEDULED);
            session.setProposedStart(null);
            session.setProposedEnd(null);
        }

        MentoringSession saved = sessionRepository.save(session);
        Map<Long, Employee> employeesByUserId = loadEmployees(List.of(actor.getUserId(), session.getCreatedByUser().getId()));
        return toSessionDto(saved, employeesByUserId);
    }

    @Transactional
    public MentoringSessionDto cancelSession(
            Long relationshipId,
            Long sessionId,
            CancelMentoringSessionRequest request,
            ApidUserPrincipal actor
    ) {
        MentoringRelationship relationship = requireRelationshipAccess(relationshipId, actor.getUserId());
        boolean isMentor = relationship.getMentorUser().getId().equals(actor.getUserId());
        if (!isMentor) {
            throw new AccessDeniedException("Only the designated mentor can cancel a mentoring session.");
        }

        MentoringSession session = sessionRepository.findById(sessionId)
                .orElseThrow(() -> new ResourceNotFoundException("Mentoring session not found."));

        if (!session.getRelationship().getId().equals(relationshipId)) {
            throw new BusinessException("SESSION_MISMATCH", "Session does not belong to this relationship.", HttpStatus.BAD_REQUEST);
        }

        if (session.getStatus() == MentoringSessionStatus.COMPLETED || session.getStatus() == MentoringSessionStatus.CANCELLED) {
            throw new BusinessException("INVALID_STATE", "Cannot cancel a completed or already cancelled session.", HttpStatus.BAD_REQUEST);
        }

        session.setStatus(MentoringSessionStatus.CANCELLED);
        session.setCancellationReason(request.reason() != null ? request.reason().trim() : "Cancelled by mentor");
        reservationService.release("MENTORING", session.getId(), session.getCancellationReason());

        MentoringSession saved = sessionRepository.save(session);
        Map<Long, Employee> employeesByUserId = loadEmployees(List.of(actor.getUserId(), session.getCreatedByUser().getId()));
        return toSessionDto(saved, employeesByUserId);
    }

    @Transactional(readOnly = true)
    public MentoringChatHistoryDto listMessages(
            Long relationshipId,
            int requestedPage,
            int requestedPageSize,
            ApidUserPrincipal actor
    ) {
        requireRelationshipAccess(relationshipId, actor.getUserId());
        if (requestedPage < 0 || requestedPage > MAX_CHAT_PAGE_INDEX) {
            throw new BusinessException("INVALID_CHAT_PAGE", "Choose a valid chat history page.");
        }
        if (requestedPageSize < 1 || requestedPageSize > MAX_CHAT_PAGE_SIZE) {
            throw new BusinessException(
                    "INVALID_CHAT_PAGE_SIZE",
                    "Chat history page size must be between 1 and " + MAX_CHAT_PAGE_SIZE + "."
            );
        }

        List<MentoringMessage> newestFirst = messageRepository.findRecentByRelationship(
                relationshipId,
                PageRequest.of(requestedPage, requestedPageSize + 1)
        );
        boolean hasMore = newestFirst.size() > requestedPageSize;
        List<MentoringMessage> page = new ArrayList<>(
                newestFirst.subList(0, Math.min(newestFirst.size(), requestedPageSize))
        );
        Collections.reverse(page);

        Map<Long, Employee> employeesByUserId = loadEmployees(page.stream()
                .map(message -> message.getSenderUser().getId())
                .toList());
        List<MentoringChatMessageDto> messages = page.stream()
                .map(message -> toMessageDto(message, actor.getUserId(), employeesByUserId))
                .toList();
        return new MentoringChatHistoryDto(messages, requestedPage, requestedPageSize, hasMore);
    }

    @Transactional
    public MentoringChatMessageDto sendMessage(
            Long relationshipId,
            MentoringChatMessageRequest body,
            ApidUserPrincipal actor
    ) {
        MentoringRelationship relationship = requireRelationshipAccess(relationshipId, actor.getUserId());
        ensureWritableParticipant(relationship, actor.getUserId());
        if (body == null || body.body() == null || body.body().isBlank()) {
            throw new BusinessException("MENTORING_MESSAGE_REQUIRED", "Enter a message before sending.");
        }
        String messageBody = body.body().trim();
        if (messageBody.length() > MAX_MESSAGE_LENGTH) {
            throw new BusinessException(
                    "MENTORING_MESSAGE_TOO_LONG",
                    "Messages cannot exceed " + MAX_MESSAGE_LENGTH + " characters."
            );
        }

        User sender = userRepository.findById(actor.getUserId())
                .orElseThrow(() -> new ResourceNotFoundException("User account not found"));
        MentoringMessage message = new MentoringMessage();
        message.setRelationship(relationship);
        message.setSenderUser(sender);
        message.setBody(messageBody);
        MentoringMessage saved = messageRepository.save(message);
        return toMessageDto(saved, actor.getUserId(), loadEmployees(List.of(actor.getUserId())));
    }

    private MentoringRelationship requireRelationshipAccess(Long relationshipId, Long userId) {
        MentoringRelationship relationship = relationshipRepository.findDetailedById(relationshipId)
                .orElseThrow(() -> new ResourceNotFoundException("Mentoring relationship not found"));
        boolean isMentor = relationship.getMentorUser().getId().equals(userId);
        boolean isTrainee = memberRepository.existsByRelationship_IdAndTraineeUser_Id(relationshipId, userId);
        if (!isMentor && !isTrainee) {
            throw new AccessDeniedException("You are not a participant in this mentoring relationship.");
        }
        return relationship;
    }

    private void ensureWritableParticipant(MentoringRelationship relationship, Long userId) {
        if (relationship.getStatus() != MentoringRelationshipStatus.ACTIVE) {
            throw new BusinessException(
                    "MENTORING_RELATIONSHIP_READ_ONLY",
                    "Chat is read-only while a mentoring relationship is paused or closed.",
                    HttpStatus.CONFLICT
            );
        }
        boolean isMentor = relationship.getMentorUser().getId().equals(userId);
        boolean activeTrainee = memberRepository.existsByRelationship_IdAndTraineeUser_IdAndStatus(
                relationship.getId(), userId, MentoringRelationshipMemberStatus.ACTIVE
        );
        if (!isMentor && !activeTrainee) {
            throw new AccessDeniedException("Only active relationship participants can send messages.");
        }
    }

    private boolean isRelationshipTrainee(MentoringRelationship relationship, Long userId) {
        return memberRepository.existsByRelationship_IdAndTraineeUser_Id(relationship.getId(), userId);
    }

    private List<Long> getRelationshipEmployeeIds(MentoringRelationship relationship) {
        List<Long> employeeIds = new ArrayList<>();
        employeeRepository.findByUserId(relationship.getMentorUser().getId())
                .ifPresent(e -> employeeIds.add(e.getId()));

        List<MentoringRelationshipMember> members = memberRepository.findByRelationship_IdOrderByJoinedAtAsc(relationship.getId());
        for (MentoringRelationshipMember m : members) {
            employeeRepository.findByUserId(m.getTraineeUser().getId())
                    .ifPresent(e -> employeeIds.add(e.getId()));
        }
        return employeeIds;
    }

    private List<CreateReservationCommand.ParticipantReservationInput> getReservationParticipants(MentoringRelationship relationship) {
        List<CreateReservationCommand.ParticipantReservationInput> commands = new ArrayList<>();
        Employee mentorEmp = employeeRepository.findByUserId(relationship.getMentorUser().getId()).orElse(null);
        if (mentorEmp != null) {
            commands.add(new CreateReservationCommand.ParticipantReservationInput(mentorEmp.getId(), ParticipationRole.MENTOR));
        }

        List<MentoringRelationshipMember> members = memberRepository.findByRelationship_IdOrderByJoinedAtAsc(relationship.getId());
        for (MentoringRelationshipMember m : members) {
            Employee traineeEmp = employeeRepository.findByUserId(m.getTraineeUser().getId()).orElse(null);
            if (traineeEmp != null) {
                commands.add(new CreateReservationCommand.ParticipantReservationInput(traineeEmp.getId(), ParticipationRole.MENTEE));
            }
        }
        return commands;
    }

    private void validateSession(MentoringSessionRequest body) {
        if (body == null || body.title() == null || body.title().isBlank()) {
            throw new BusinessException("MENTORING_SESSION_TITLE_REQUIRED", "Enter a session title.");
        }
        if (body.title().trim().length() > 180) {
            throw new BusinessException("MENTORING_SESSION_TITLE_TOO_LONG", "Session titles cannot exceed 180 characters.");
        }
        if (body.agenda() != null && body.agenda().length() > 2000) {
            throw new BusinessException("MENTORING_SESSION_AGENDA_TOO_LONG", "Session agendas cannot exceed 2000 characters.");
        }
        if (body.scheduledStart() == null || body.scheduledEnd() == null
                || !body.scheduledStart().isAfter(Instant.now())
                || !body.scheduledEnd().isAfter(body.scheduledStart())) {
            throw new BusinessException(
                    "INVALID_MENTORING_SESSION_TIME",
                    "Choose a future start time and an end time after the start."
            );
        }
        ZoneId eatZone = ZoneId.of("Africa/Addis_Ababa");
        if (body.scheduledStart().atZone(eatZone).getDayOfWeek() == DayOfWeek.SUNDAY) {
            throw new BusinessException("SUNDAY_NOT_ALLOWED", "Bank policy strictly prohibits scheduling sessions on Sundays.", HttpStatus.BAD_REQUEST);
        }
        if (body.deliveryMode() == null) {
            throw new BusinessException("MENTORING_DELIVERY_MODE_REQUIRED", "Choose a delivery mode.");
        }
    }

    private String normalizeMeetingUrl(String value) {
        String normalized = normalizeOptionalText(value);
        if (normalized == null) {
            return null;
        }
        if (normalized.length() > 1000) {
            throw new BusinessException("MENTORING_MEETING_URL_TOO_LONG", "Meeting links cannot exceed 1000 characters.");
        }
        try {
            URI uri = URI.create(normalized);
            if (uri.getHost() == null
                    || (!"https".equalsIgnoreCase(uri.getScheme()) && !"http".equalsIgnoreCase(uri.getScheme()))) {
                throw new IllegalArgumentException();
            }
        } catch (IllegalArgumentException exception) {
            throw new BusinessException(
                    "INVALID_MENTORING_MEETING_URL",
                    "Enter a valid HTTP or HTTPS meeting link."
            );
        }
        return normalized;
    }

    private String normalizeOptionalText(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        return value.trim();
    }

    private Map<Long, Employee> loadEmployees(Iterable<Long> userIds) {
        List<Long> ids = new ArrayList<>();
        userIds.forEach(ids::add);
        if (ids.isEmpty()) {
            return Map.of();
        }
        Map<Long, Employee> employees = new LinkedHashMap<>();
        employeeRepository.findDetailedByUserIdIn(ids)
                .forEach(employee -> employees.put(employee.getUserId(), employee));
        return employees;
    }

    private String employeeName(Long userId, String username, Map<Long, Employee> employeesByUserId) {
        Employee employee = employeesByUserId.get(userId);
        return employee == null ? username : employee.getFullName();
    }

    @Transactional(readOnly = true)
    public SessionJoinTokenDto getJoinToken(Long relationshipId, Long sessionId, ApidUserPrincipal actor) {
        MentoringRelationship relationship = requireRelationshipAccess(relationshipId, actor.getUserId());
        MentoringSession session = sessionRepository.findById(sessionId)
                .orElseThrow(() -> new ResourceNotFoundException("Mentoring session not found."));

        if (!session.getRelationship().getId().equals(relationshipId)) {
            throw new BusinessException("SESSION_MISMATCH", "Session does not belong to this relationship.", HttpStatus.BAD_REQUEST);
        }

        if (session.getDeliveryMode() != MentoringDeliveryMode.ONLINE && session.getDeliveryMode() != MentoringDeliveryMode.HYBRID) {
            throw new BusinessException("NOT_A_VIDEO_SESSION", "This mentoring session is configured for in-person delivery.", HttpStatus.BAD_REQUEST);
        }

        Employee callerEmp = employeeRepository.findByUserId(actor.getUserId()).orElse(null);
        String empNo = callerEmp != null ? callerEmp.getEmployeeNumber() : "USR-" + actor.getUserId();
        String fullName = callerEmp != null ? callerEmp.getFullName() : actor.getUsername();
        boolean isOwner = relationship.getMentorUser().getId().equals(actor.getUserId());

        String meetingUrl = session.getMeetingUrl();
        String roomName;
        if (meetingUrl != null && meetingUrl.contains("/")) {
            roomName = meetingUrl.substring(meetingUrl.lastIndexOf('/') + 1);
            if (roomName.contains("?")) {
                roomName = roomName.substring(0, roomName.indexOf('?'));
            }
        } else {
            roomName = "mentoring-rel" + relationshipId + "-s" + sessionId;
        }

        Instant expiry = session.getScheduledEnd().plus(Duration.ofHours(3));
        MeetingTokenDetails tokenDetails = videoMeetingProvider.createParticipantToken(
                roomName,
                empNo,
                fullName,
                isOwner,
                expiry
        );

        return new SessionJoinTokenDto(
                roomName,
                tokenDetails.token(),
                tokenDetails.roomUrlWithToken(),
                tokenDetails.expiresAt(),
                tokenDetails.isMock()
        );
    }

    private MentoringSessionDto toSessionDto(
            MentoringSession session,
            Map<Long, Employee> employeesByUserId
    ) {
        User creator = session.getCreatedByUser();
        String meetingUrl = session.getMeetingUrl();
        if ((session.getDeliveryMode() == MentoringDeliveryMode.ONLINE || session.getDeliveryMode() == MentoringDeliveryMode.HYBRID)
                && (meetingUrl == null || meetingUrl.isBlank())) {
            meetingUrl = "https://amakari.daily.co/boa-mentoring-rel" + session.getRelationship().getId() + "-s" + session.getId();
        }

        return new MentoringSessionDto(
                session.getId(),
                session.getRelationship().getId(),
                session.getTitle(),
                session.getAgenda(),
                session.getScheduledStart(),
                session.getScheduledEnd(),
                session.getDeliveryMode(),
                meetingUrl,
                session.getLocation(),
                session.getStatus(),
                creator.getId(),
                employeeName(creator.getId(), creator.getUsername(), employeesByUserId),
                session.getDeclineReason(),
                session.getRescheduleReason(),
                session.getProposedStart(),
                session.getProposedEnd(),
                session.getRespondedAt(),
                session.getCancellationReason(),
                session.getNotes(),
                session.getCreatedAt()
        );
    }

    private MentoringChatMessageDto toMessageDto(
            MentoringMessage message,
            Long currentUserId,
            Map<Long, Employee> employeesByUserId
    ) {
        User sender = message.getSenderUser();
        return new MentoringChatMessageDto(
                message.getId(),
                message.getRelationship().getId(),
                sender.getId(),
                employeeName(sender.getId(), sender.getUsername(), employeesByUserId),
                message.getBody(),
                message.getCreatedAt(),
                sender.getId().equals(currentUserId)
        );
    }
}
