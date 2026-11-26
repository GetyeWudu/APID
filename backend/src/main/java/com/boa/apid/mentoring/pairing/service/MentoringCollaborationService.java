package com.boa.apid.mentoring.pairing.service;

import com.boa.apid.platform.video.api.MeetingRoomDetails;
import com.boa.apid.platform.video.api.MeetingTokenDetails;
import com.boa.apid.platform.video.api.SessionJoinTokenDto;
import com.boa.apid.platform.video.api.VideoMeetingProvider;
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
import com.boa.apid.mentoring.pairing.entity.MentoringRequestType;
import com.boa.apid.mentoring.pairing.entity.MentoringSession;
import com.boa.apid.mentoring.pairing.entity.MentoringSessionAttendee;
import com.boa.apid.mentoring.pairing.entity.MentoringSessionStatus;
import com.boa.apid.mentoring.pairing.entity.MentoringSessionTarget;
import com.boa.apid.mentoring.pairing.repository.MentoringMessageRepository;
import com.boa.apid.mentoring.pairing.repository.MentoringRelationshipMemberRepository;
import com.boa.apid.mentoring.pairing.repository.MentoringRelationshipRepository;
import com.boa.apid.mentoring.pairing.repository.MentoringSessionRepository;
import com.boa.apid.mentoring.pairing.repository.MentoringSessionAttendeeRepository;
import com.boa.apid.mentoring.pairing.repository.MentoringSessionTargetRepository;
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
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

@Service
public class MentoringCollaborationService {

    private static final Logger log = LoggerFactory.getLogger(MentoringCollaborationService.class);

    private static final int MAX_MESSAGE_LENGTH = 4000;
    private static final int MAX_CHAT_PAGE_SIZE = 100;
    private static final int MAX_CHAT_PAGE_INDEX = 10000;

    private final MentoringRelationshipRepository relationshipRepository;
    private final MentoringRelationshipMemberRepository memberRepository;
    private final MentoringSessionRepository sessionRepository;
    private final MentoringSessionTargetRepository sessionTargetRepository;
    private final MentoringSessionAttendeeRepository sessionAttendeeRepository;
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
            MentoringSessionTargetRepository sessionTargetRepository,
            MentoringSessionAttendeeRepository sessionAttendeeRepository,
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
        this.sessionTargetRepository = sessionTargetRepository;
        this.sessionAttendeeRepository = sessionAttendeeRepository;
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
        Map<Long, List<Long>> targetsBySession = loadSessionTargetUserIds(
                sessions.stream().map(MentoringSession::getId).toList());
        List<MentoringSession> visibleSessions = sessions.stream()
                .filter(session -> isSessionVisibleTo(session, actor.getUserId(), targetsBySession))
                .toList();
        Map<Long, Employee> employeesByUserId = employeesIncludingTargets(
                loadSessionEmployees(visibleSessions),
                targetsBySession
        );
        Map<Long, List<MentoringSessionAttendee>> attendeesBySession = loadSessionAttendees(
                visibleSessions.stream().map(MentoringSession::getId).toList());
        return visibleSessions.stream()
                .map(session -> toSessionDto(
                        session, employeesByUserId, targetsBySession, attendeesBySession, actor.getUserId()))
                .toList();
    }

    @Transactional(readOnly = true)
    public List<MentoringSessionDto> listMySessions(ApidUserPrincipal actor) {
        List<Long> relationshipIds = memberRepository.findVisibleToUser(actor.getUserId()).stream()
                .map(member -> member.getRelationship().getId())
                .distinct()
                .toList();

        // Regular pairing sessions
        List<MentoringSession> sessions = relationshipIds.isEmpty()
                ? new java.util.ArrayList<>()
                : new java.util.ArrayList<>(
                        sessionRepository.findByRelationship_IdInOrderByScheduledStartDesc(relationshipIds));

        // Group sessions where this user is a targeted participant
        List<MentoringSession> groupSessions =
                sessionRepository.findGroupSessionsByTraineeUserId(actor.getUserId());
        // Also include group sessions created by this user (mentor view)
        List<MentoringSession> mentorGroupSessions =
                sessionRepository.findGroupSessionsByMentorUserId(actor.getUserId());

        // Merge, deduplicate by id
        java.util.Set<Long> seen = new java.util.HashSet<>();
        List<MentoringSession> allSessions = new java.util.ArrayList<>();
        for (MentoringSession s : sessions) {
            if (seen.add(s.getId())) allSessions.add(s);
        }
        for (MentoringSession s : groupSessions) {
            if (seen.add(s.getId())) allSessions.add(s);
        }
        for (MentoringSession s : mentorGroupSessions) {
            if (seen.add(s.getId())) allSessions.add(s);
        }
        allSessions.sort(java.util.Comparator.comparing(MentoringSession::getScheduledStart).reversed());

        Map<Long, List<Long>> targetsBySession = loadSessionTargetUserIds(
                allSessions.stream().map(MentoringSession::getId).toList());
        List<MentoringSession> visibleSessions = allSessions.stream()
                .filter(session -> isSessionVisibleTo(session, actor.getUserId(), targetsBySession))
                .toList();
        Map<Long, Employee> employeesByUserId = employeesIncludingTargets(
                loadSessionEmployees(visibleSessions),
                targetsBySession
        );
        Map<Long, List<MentoringSessionAttendee>> attendeesBySession = loadSessionAttendees(
                visibleSessions.stream().map(MentoringSession::getId).toList());
        return visibleSessions.stream()
                .map(session -> toSessionDto(
                        session, employeesByUserId, targetsBySession, attendeesBySession, actor.getUserId()))
                .toList();
    }

    @Transactional
    public MentoringSessionDto submitSessionReport(
            Long relationshipId,
            Long sessionId,
            MentoringSessionReportRequest request,
            ApidUserPrincipal actor
    ) {
        MentoringRelationship relationship = requireRelationshipAccess(relationshipId, actor.getUserId());
        if (!relationship.getMentorUser().getId().equals(actor.getUserId())) {
            throw new AccessDeniedException("Only the mentor can submit the end-of-session report.");
        }

        MentoringSession session = sessionRepository.findByIdForUpdate(sessionId)
                .orElseThrow(() -> new ResourceNotFoundException("Mentoring session not found."));
        if (!session.getRelationship().getId().equals(relationshipId)) {
            throw new BusinessException("SESSION_MISMATCH", "Session does not belong to this relationship.", HttpStatus.BAD_REQUEST);
        }
        if (session.getStatus() != MentoringSessionStatus.SCHEDULED) {
            throw new BusinessException(
                    "INVALID_SESSION_REPORT_STATE",
                    "Only a scheduled session without a report can be completed.",
                    HttpStatus.CONFLICT
            );
        }
        if (session.getScheduledEnd().isAfter(Instant.now())) {
            throw new BusinessException(
                    "MENTORING_SESSION_NOT_ENDED",
                    "The session report can be submitted after the scheduled session end time.",
                    HttpStatus.CONFLICT
            );
        }
        if (request == null || request.reportNote() == null || request.reportNote().isBlank()
                || request.reportNote().trim().length() > 4000) {
            throw new BusinessException(
                    "INVALID_MENTORING_SESSION_REPORT",
                    "Enter a session report of 4000 characters or fewer."
            );
        }

        session.setNotes(request.reportNote().trim());
        session.setStatus(MentoringSessionStatus.COMPLETED);
        MentoringSession saved = sessionRepository.save(session);
        reservationService.release("MENTORING", sessionId, "Session report submitted.");
        Map<Long, Employee> employeesByUserId = loadSessionEmployees(saved, actor.getUserId());
        return toSessionDto(
                saved,
                employeesByUserId,
                loadSessionTargetUserIds(List.of(saved.getId())),
                loadSessionAttendees(List.of(saved.getId())),
                actor.getUserId()
        );
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
        MentoringRelationshipMember targetTrainee = resolveTargetTrainee(relationship, body.traineeUserId(), body.targetTraineeUserIds());

        // Determine effective target list for multi-target subset sessions
        List<MentoringRelationshipMember> subsetTargetMembers = resolveSubsetTargetMembers(
                relationship, body.targetTraineeUserIds(), body.traineeUserId());

        String meetingUrl = normalizeMeetingUrl(body.meetingUrl());
        String roomName = null;
        if ((body.deliveryMode() == MentoringDeliveryMode.ONLINE || body.deliveryMode() == MentoringDeliveryMode.HYBRID)
                && (meetingUrl == null || meetingUrl.isBlank())) {
            String prefix = "mentoring-rel" + relationship.getId();
            Instant expiry = body.scheduledEnd().plus(Duration.ofHours(3));
            MeetingRoomDetails room = videoMeetingProvider.createRoom(prefix, expiry);
            roomName = room.roomName();
            meetingUrl = room.roomUrl();
        }

        MentoringSession session = new MentoringSession();
        session.setRelationship(relationship);
        session.setTargetTraineeMember(targetTrainee);
        session.setTitle(body.title().trim());
        session.setAgenda(normalizeOptionalText(body.agenda()));
        session.setScheduledStart(body.scheduledStart());
        session.setScheduledEnd(body.scheduledEnd());
        session.setDeliveryMode(body.deliveryMode());
        session.setMeetingUrl(meetingUrl);
        session.setMeetingRoomName(roomName);
        session.setMeetingRoomUrl(meetingUrl);
        session.setMeetingProvider(videoMeetingProvider.getProviderName());
        session.setLocation(normalizeOptionalText(body.location()));
        session.setStatus(MentoringSessionStatus.PENDING);
        session.setCreatedByUser(relationship.getMentorUser());

        MentoringSession saved = sessionRepository.save(session);

        // Insert subset target rows when targeting multiple (but not all) group members
        if (!subsetTargetMembers.isEmpty()) {
            for (MentoringRelationshipMember subsetMember : subsetTargetMembers) {
                MentoringSessionTarget target = new MentoringSessionTarget();
                target.setSession(saved);
                target.setMember(subsetMember);
                sessionTargetRepository.save(target);
            }
        }
        List<MentoringRelationshipMember> sessionAttendees = resolveSessionAttendees(
                relationship, targetTrainee, subsetTargetMembers);
        saveSessionAttendees(saved, sessionAttendees);

        // Register central reservation & enforce cross-module conflict check
        List<CreateReservationCommand.ParticipantReservationInput> participants =
                getReservationParticipants(relationship, targetTrainee, subsetTargetMembers);
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

        Map<Long, Employee> employeesByUserId = loadSessionEmployees(saved, actor.getUserId());
        Map<Long, List<Long>> targetsBySession = loadSessionTargetUserIds(List.of(saved.getId()));
        return toSessionDto(
                saved,
                employeesByUserId,
                targetsBySession,
                loadSessionAttendees(List.of(saved.getId())),
                actor.getUserId()
        );
    }

    @Transactional
    public MentoringSessionDto respondSession(
            Long relationshipId,
            Long sessionId,
            RespondMentoringSessionRequest request,
            ApidUserPrincipal actor
    ) {
        MentoringSession session = requireSessionParticipantAccess(relationshipId, sessionId, actor.getUserId());
        if (isSessionMentor(session, actor.getUserId())) {
            throw new AccessDeniedException("Only an invited mentee can accept or decline this session.");
        }
        if (request == null) {
            throw new BusinessException("INVALID_SESSION_RESPONSE", "Choose whether to accept or decline the session.");
        }
        if (session.getStatus() != MentoringSessionStatus.PENDING || session.getProposedStart() != null) {
            throw new BusinessException(
                    "INVALID_STATE",
                    "This session is waiting on a schedule proposal or is no longer pending.",
                    HttpStatus.BAD_REQUEST
            );
        }
        MentoringSessionAttendee attendee = getSessionAttendee(session, actor.getUserId());
        session.setRespondedAt(Instant.now());
        if (request.accept()) {
            attendee.setAcceptedScheduledStart(session.getScheduledStart());
            sessionAttendeeRepository.save(attendee);
            updateStatusWhenAllAttendeesAccepted(session);
        } else {
            if (request.declineReason() == null || request.declineReason().isBlank()) {
                throw new BusinessException("DECLINE_REASON_REQUIRED", "Bank policy requires an explanatory reason when declining a session.", HttpStatus.BAD_REQUEST);
            }
            session.setStatus(MentoringSessionStatus.DECLINED);
            session.setDeclineReason(request.declineReason().trim());
            reservationService.release("MENTORING", session.getId(), "Trainee declined: " + request.declineReason().trim());
        }

        MentoringSession saved = sessionRepository.save(session);
        Map<Long, Employee> employeesByUserId = loadSessionEmployees(saved, actor.getUserId());
        return toSessionDto(
                saved,
                employeesByUserId,
                loadSessionTargetUserIds(List.of(saved.getId())),
                loadSessionAttendees(List.of(saved.getId())),
                actor.getUserId()
        );
    }

    @Transactional
    public MentoringSessionDto proposeReschedule(
            Long relationshipId,
            Long sessionId,
            ProposeMentoringRescheduleRequest request,
            ApidUserPrincipal actor
    ) {
        MentoringSession session = requireSessionParticipantAccess(relationshipId, sessionId, actor.getUserId());
        if (session.getStatus() == MentoringSessionStatus.COMPLETED
                || session.getStatus() == MentoringSessionStatus.CANCELLED
                || session.getStatus() == MentoringSessionStatus.DECLINED) {
            throw new BusinessException("INVALID_STATE", "Cannot reschedule a completed or cancelled session.", HttpStatus.BAD_REQUEST);
        }

        if (request == null || request.proposedStart() == null || request.proposedEnd() == null
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

        List<Long> employeeIds = getSessionEmployeeIds(session);
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

        resetSessionAttendeeAcceptances(session);
        session.setStatus(MentoringSessionStatus.PENDING);
        session.setProposedStart(request.proposedStart());
        session.setProposedEnd(request.proposedEnd());
        session.setRescheduleReason(request.reason().trim());
        session.setProposedByUserId(actor.getUserId());
        session.setRespondedAt(Instant.now());

        MentoringSession saved = sessionRepository.save(session);
        Map<Long, Employee> employeesByUserId = loadSessionEmployees(saved, actor.getUserId());
        return toSessionDto(
                saved,
                employeesByUserId,
                loadSessionTargetUserIds(List.of(saved.getId())),
                loadSessionAttendees(List.of(saved.getId())),
                actor.getUserId()
        );
    }

    @Transactional
    public MentoringSessionDto respondReschedule(
            Long relationshipId,
            Long sessionId,
            boolean accept,
            ApidUserPrincipal actor
    ) {
        MentoringSession session = requireSessionParticipantAccess(relationshipId, sessionId, actor.getUserId());
        Long proposedByUserId = session.getProposedByUserId();
        boolean isMentor = isSessionMentor(session, actor.getUserId());
        boolean isProposalPending = session.getProposedStart() != null
                && session.getProposedEnd() != null
                && (session.getStatus() == MentoringSessionStatus.PENDING
                    || session.getStatus() == MentoringSessionStatus.RESCHEDULE_PROPOSED);
        if (!isProposalPending) {
            throw new BusinessException("INVALID_STATE", "There is no pending schedule proposal for this session.", HttpStatus.BAD_REQUEST);
        }

        if (isMentor) {
            if (proposedByUserId != null && proposedByUserId.equals(actor.getUserId())) {
                throw new BusinessException("INVALID_STATE", "You cannot accept your own schedule proposal.", HttpStatus.BAD_REQUEST);
            }
            if (!accept) {
                session.setProposedStart(null);
                session.setProposedEnd(null);
                session.setProposedByUserId(null);
                session.setRescheduleReason(null);
                session.setStatus(MentoringSessionStatus.PENDING);
            } else {
                commitProposedSchedule(session, proposedByUserId);
            }
        } else {
            if (!actor.getUserId().equals(proposedByUserId) && !session.getCreatedByUser().getId().equals(proposedByUserId)) {
                throw new AccessDeniedException("Only the mentor can respond to a participant's schedule proposal.");
            }
            if (!accept) {
                throw new BusinessException(
                        "ALTERNATE_TIME_REQUIRED",
                        "Propose another time or decline the session instead of rejecting the mentor's proposed time.",
                        HttpStatus.BAD_REQUEST
                );
            }
            if (!session.getCreatedByUser().getId().equals(proposedByUserId)) {
                throw new AccessDeniedException("The mentor must respond to a participant's schedule proposal.");
            }
            commitProposedSchedule(session, actor.getUserId());
        }
        session.setRespondedAt(Instant.now());
        MentoringSession saved = sessionRepository.save(session);
        Map<Long, Employee> employeesByUserId = loadSessionEmployees(saved, actor.getUserId());
        return toSessionDto(
                saved,
                employeesByUserId,
                loadSessionTargetUserIds(List.of(saved.getId())),
                loadSessionAttendees(List.of(saved.getId())),
                actor.getUserId()
        );
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
        Map<Long, Employee> employeesByUserId = loadSessionEmployees(saved, actor.getUserId());
        return toSessionDto(
                saved,
                employeesByUserId,
                loadSessionTargetUserIds(List.of(saved.getId())),
                loadSessionAttendees(List.of(saved.getId())),
                actor.getUserId()
        );
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

    private MentoringRelationshipMember resolveTargetTrainee(
            MentoringRelationship relationship,
            Long traineeUserId,
            List<Long> targetTraineeUserIds
    ) {
        // Priority: targetTraineeUserIds over traineeUserId
        List<Long> effectiveIds = (targetTraineeUserIds != null && !targetTraineeUserIds.isEmpty())
                ? targetTraineeUserIds
                : (traineeUserId != null ? List.of(traineeUserId) : null);

        if (effectiveIds == null || effectiveIds.isEmpty()) {
            // No specific target — means ALL (valid for GROUP, or INDIVIDUAL with one implicit trainee)
            if (relationship.getRequest().getRequestType() == MentoringRequestType.GROUP) {
                return null; // targeting all group members
            }
            return null; // INDIVIDUAL: single-member, targetTraineeMember remains null
        }

        if (effectiveIds.size() >= 2) {
            // Multi-target subset — targetTraineeMember is null, targets stored separately
            return null;
        }

        // Single target
        Long singleTraineeUserId = effectiveIds.get(0);
        return memberRepository.findByRelationship_IdAndTraineeUser_IdAndStatus(
                        relationship.getId(),
                        singleTraineeUserId,
                        MentoringRelationshipMemberStatus.ACTIVE
                )
                .orElseThrow(() -> new BusinessException(
                        "INVALID_MENTORING_SESSION_TRAINEE",
                        "Choose an active trainee in this mentoring relationship."
                ));
    }

    /**
     * Returns the list of members to store in mentoring_session_targets when the session
     * targets a subset of a group (2+ trainee IDs). Returns empty list otherwise.
     */
    private List<MentoringRelationshipMember> resolveSubsetTargetMembers(
            MentoringRelationship relationship,
            List<Long> targetTraineeUserIds,
            Long legacyTraineeUserId
    ) {
        List<Long> effectiveIds = (targetTraineeUserIds != null && !targetTraineeUserIds.isEmpty())
                ? targetTraineeUserIds
                : (legacyTraineeUserId != null ? List.of(legacyTraineeUserId) : null);

        if (effectiveIds == null || effectiveIds.size() < 2) {
            return List.of();
        }

        // GROUP subset: resolve each member
        List<MentoringRelationshipMember> result = new ArrayList<>();
        for (Long traineeId : effectiveIds) {
            MentoringRelationshipMember member = memberRepository
                    .findByRelationship_IdAndTraineeUser_IdAndStatus(
                            relationship.getId(), traineeId, MentoringRelationshipMemberStatus.ACTIVE)
                    .orElseThrow(() -> new BusinessException(
                            "INVALID_MENTORING_SESSION_TRAINEE",
                            "Trainee " + traineeId + " is not an active member of this relationship."
                    ));
            result.add(member);
        }
        return result;
    }

    private boolean isSessionVisibleTo(MentoringSession session, Long userId) {
        // Mentor always sees all sessions
        if (session.getRelationship().getMentorUser().getId().equals(userId)) {
            return true;
        }
        MentoringRelationshipMember targetTrainee = session.getTargetTraineeMember();
        if (targetTrainee != null) {
            return targetTrainee.getTraineeUser().getId().equals(userId);
        }
        // Check subset targets
        List<MentoringSessionTarget> targets = sessionTargetRepository.findBySessionId(session.getId());
        if (targets.isEmpty()) {
            return true; // GROUP_ALL
        }
        return targets.stream()
                .anyMatch(t -> t.getMember().getTraineeUser().getId().equals(userId));
    }

    private boolean isSessionVisibleTo(
            MentoringSession session,
            Long userId,
            Map<Long, List<Long>> targetsBySession
    ) {
        if (session.getRelationship().getMentorUser().getId().equals(userId)) {
            return true;
        }
        MentoringRelationshipMember targetTrainee = session.getTargetTraineeMember();
        if (targetTrainee != null) {
            return targetTrainee.getTraineeUser().getId().equals(userId);
        }
        List<Long> subsetUserIds = targetsBySession.get(session.getId());
        if (subsetUserIds == null || subsetUserIds.isEmpty()) {
            return true; // GROUP_ALL
        }
        return subsetUserIds.contains(userId);
    }

    private void ensureSessionVisibleTo(MentoringSession session, Long userId) {
        if (!isSessionVisibleTo(session, userId)) {
            throw new ResourceNotFoundException("Mentoring session not found.");
        }
    }

    private List<Long> getSessionEmployeeIds(MentoringSession session) {
        List<Long> employeeIds = new ArrayList<>();
        employeeRepository.findByUserId(session.getCreatedByUser().getId())
                .ifPresent(e -> employeeIds.add(e.getId()));

        for (MentoringSessionAttendee attendee : sessionAttendeeRepository.findBySession_Id(session.getId())) {
            MentoringRelationshipMember m = attendee.getMember();
            employeeRepository.findByUserId(m.getTraineeUser().getId())
                    .ifPresent(e -> employeeIds.add(e.getId()));
        }
        return employeeIds.stream().distinct().toList();
    }

    private List<CreateReservationCommand.ParticipantReservationInput> getReservationParticipants(
            MentoringRelationship relationship,
            MentoringRelationshipMember targetTrainee,
            List<MentoringRelationshipMember> subsetMembers
    ) {
        List<CreateReservationCommand.ParticipantReservationInput> commands = new ArrayList<>();
        Employee mentorEmp = employeeRepository.findByUserId(relationship.getMentorUser().getId()).orElse(null);
        if (mentorEmp != null) {
            commands.add(new CreateReservationCommand.ParticipantReservationInput(mentorEmp.getId(), ParticipationRole.MENTOR));
        }

        List<MentoringRelationshipMember> members;
        if (!subsetMembers.isEmpty()) {
            members = subsetMembers;
        } else if (targetTrainee != null) {
            members = List.of(targetTrainee);
        } else {
            members = memberRepository.findByRelationship_IdOrderByJoinedAtAsc(relationship.getId());
        }
        for (MentoringRelationshipMember m : members) {
            Employee traineeEmp = employeeRepository.findByUserId(m.getTraineeUser().getId()).orElse(null);
            if (traineeEmp != null) {
                commands.add(new CreateReservationCommand.ParticipantReservationInput(traineeEmp.getId(), ParticipationRole.MENTEE));
            }
        }
        return commands;
    }

    /**
     * Batch-loads session target trainee user IDs for a list of sessions.
     * Returns map: sessionId → list of trainee user IDs (empty list = GROUP_ALL).
     */
    private Map<Long, List<Long>> loadSessionTargetUserIds(List<Long> sessionIds) {
        if (sessionIds.isEmpty()) {
            return Map.of();
        }
        Map<Long, List<Long>> result = new HashMap<>();
        List<MentoringSessionTarget> targets = sessionTargetRepository.findBySessionIdIn(sessionIds);
        for (MentoringSessionTarget target : targets) {
            result.computeIfAbsent(target.getSession().getId(), k -> new ArrayList<>())
                    .add(target.getMember().getTraineeUser().getId());
        }
        return result;
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

    private Map<Long, Employee> loadSessionEmployees(MentoringSession session, Long... additionalUserIds) {
        return loadSessionEmployees(List.of(session), additionalUserIds);
    }

    private Map<Long, Employee> loadSessionEmployees(
            List<MentoringSession> sessions,
            Long... additionalUserIds
    ) {
        Set<Long> userIds = new LinkedHashSet<>();
        for (MentoringSession session : sessions) {
            userIds.add(session.getCreatedByUser().getId());
            if (session.getTargetTraineeMember() != null) {
                userIds.add(session.getTargetTraineeMember().getTraineeUser().getId());
            }
        }
        for (Long userId : additionalUserIds) {
            if (userId != null) {
                userIds.add(userId);
            }
        }
        return loadEmployees(userIds);
    }

    private Map<Long, Employee> employeesIncludingTargets(
            Map<Long, Employee> employeesByUserId,
            Map<Long, List<Long>> targetsBySession
    ) {
        Set<Long> missing = new LinkedHashSet<>();
        for (List<Long> userIds : targetsBySession.values()) {
            for (Long userId : userIds) {
                if (userId != null && !employeesByUserId.containsKey(userId)) {
                    missing.add(userId);
                }
            }
        }
        if (missing.isEmpty()) {
            return employeesByUserId;
        }
        Map<Long, Employee> merged = new LinkedHashMap<>(employeesByUserId);
        merged.putAll(loadEmployees(missing));
        return merged;
    }

    private List<MentoringSessionParticipantDto> namedParticipants(
            List<Long> userIds,
            Map<Long, Employee> employeesByUserId
    ) {
        if (userIds == null || userIds.isEmpty()) {
            return null;
        }
        Map<Long, Employee> names = employeesByUserId;
        List<Long> missing = userIds.stream()
                .filter(userId -> userId != null && !employeesByUserId.containsKey(userId))
                .toList();
        if (!missing.isEmpty()) {
            names = new LinkedHashMap<>(employeesByUserId);
            names.putAll(loadEmployees(missing));
        }
        List<MentoringSessionParticipantDto> participants = new ArrayList<>();
        for (Long userId : userIds) {
            if (userId == null) {
                continue;
            }
            Employee employee = names.get(userId);
            participants.add(new MentoringSessionParticipantDto(
                    userId,
                    employee == null ? "Trainee #" + userId : employee.getFullName()
            ));
        }
        return participants;
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

        ensureSessionVisibleTo(session, actor.getUserId());

        if (session.getDeliveryMode() != MentoringDeliveryMode.ONLINE && session.getDeliveryMode() != MentoringDeliveryMode.HYBRID) {
            throw new BusinessException("NOT_A_VIDEO_SESSION", "This mentoring session is configured for in-person delivery.", HttpStatus.BAD_REQUEST);
        }
        Instant now = Instant.now();
        if (session.getStatus() != MentoringSessionStatus.SCHEDULED
                || now.isBefore(session.getScheduledStart())
                || !now.isBefore(session.getScheduledEnd())) {
            throw new BusinessException(
                    "MENTORING_SESSION_NOT_JOINABLE",
                    "Video access is available only during the scheduled session time.",
                    HttpStatus.CONFLICT
            );
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
            Map<Long, Employee> employeesByUserId,
            Map<Long, List<Long>> targetsBySession,
            Map<Long, List<MentoringSessionAttendee>> attendeesBySession,
            Long currentUserId
    ) {
        User creator = session.getCreatedByUser();
        MentoringRelationshipMember targetTrainee = session.getTargetTraineeMember();
        String meetingUrl = session.getMeetingUrl();
        if ((session.getDeliveryMode() == MentoringDeliveryMode.ONLINE || session.getDeliveryMode() == MentoringDeliveryMode.HYBRID)
                && (meetingUrl == null || meetingUrl.isBlank())) {
            meetingUrl = "wss://apid-livekit.home.arpa/boa-mentoring-rel" + session.getRelationship().getId() + "-s" + session.getId();
        }

        // Determine sessionScope and targetTraineeUserIds
        List<Long> subsetUserIds = targetsBySession.getOrDefault(session.getId(), List.of());
        String sessionScope;
        List<Long> targetUserIdsForDto;
        if (targetTrainee != null) {
            sessionScope = "INDIVIDUAL";
            targetUserIdsForDto = null;
        } else if (!subsetUserIds.isEmpty()) {
            sessionScope = "GROUP_SUBSET";
            targetUserIdsForDto = subsetUserIds;
        } else {
            sessionScope = "GROUP_ALL";
            targetUserIdsForDto = null;
        }

        List<MentoringSessionParticipantDto> targetTrainees = namedParticipants(
                targetUserIdsForDto,
                employeesByUserId
        );
        List<MentoringSessionAttendee> attendees =
                attendeesBySession.getOrDefault(session.getId(), List.of());
        int acceptedParticipantCount = (int) attendees.stream()
                .filter(attendee -> attendee.hasAccepted(session.getScheduledStart()))
                .count();
        boolean currentUserAccepted = attendees.stream()
                .anyMatch(attendee -> attendee.getMember().getTraineeUser().getId().equals(currentUserId)
                        && attendee.hasAccepted(session.getScheduledStart()));

        return new MentoringSessionDto(
                session.getId(),
                session.getRelationship().getId(),
                targetTrainee == null ? null : targetTrainee.getTraineeUser().getId(),
                targetTrainee == null
                        ? null
                        : employeeName(
                                targetTrainee.getTraineeUser().getId(),
                                targetTrainee.getTraineeUser().getUsername(),
                                employeesByUserId
                        ),
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
                session.getCreatedAt(),
                sessionScope,
                targetUserIdsForDto,
                session.isGroupSession(),
                targetTrainees,
                session.getProposedByUserId(),
                currentUserAccepted,
                acceptedParticipantCount,
                attendees.size()
        );
    }

    private Map<Long, List<MentoringSessionAttendee>> loadSessionAttendees(List<Long> sessionIds) {
        if (sessionIds.isEmpty()) {
            return Map.of();
        }
        return sessionAttendeeRepository.findBySessionIdIn(sessionIds).stream()
                .collect(Collectors.groupingBy(attendee -> attendee.getSession().getId()));
    }

    private List<MentoringRelationshipMember> resolveSessionAttendees(
            MentoringRelationship relationship,
            MentoringRelationshipMember targetTrainee,
            List<MentoringRelationshipMember> subsetTargetMembers
    ) {
        if (!subsetTargetMembers.isEmpty()) {
            return subsetTargetMembers;
        }
        if (targetTrainee != null) {
            return List.of(targetTrainee);
        }
        return memberRepository.findByRelationship_IdOrderByJoinedAtAsc(relationship.getId()).stream()
                .filter(member -> member.getStatus() == MentoringRelationshipMemberStatus.ACTIVE)
                .toList();
    }

    private void saveSessionAttendees(
            MentoringSession session,
            List<MentoringRelationshipMember> members
    ) {
        List<MentoringSessionAttendee> attendees = members.stream()
                .map(member -> {
                    MentoringSessionAttendee attendee = new MentoringSessionAttendee();
                    attendee.setSession(session);
                    attendee.setMember(member);
                    return attendee;
                })
                .toList();
        sessionAttendeeRepository.saveAll(attendees);
    }

    private MentoringSession requireSessionParticipantAccess(
            Long relationshipId,
            Long sessionId,
            Long userId
    ) {
        MentoringSession session = sessionRepository.findByIdForUpdate(sessionId)
                .orElseThrow(() -> new ResourceNotFoundException("Mentoring session not found."));
        if (!session.isGroupSession() && !session.getRelationship().getId().equals(relationshipId)) {
            throw new BusinessException("SESSION_MISMATCH", "Session does not belong to this relationship.", HttpStatus.BAD_REQUEST);
        }
        if (!isSessionMentor(session, userId)
                && sessionAttendeeRepository.findBySession_IdAndMember_TraineeUser_Id(sessionId, userId).isEmpty()) {
            throw new AccessDeniedException("Only an invited mentee or the session mentor can respond.");
        }
        return session;
    }

    private boolean isSessionMentor(MentoringSession session, Long userId) {
        return session.getCreatedByUser().getId().equals(userId);
    }

    private MentoringSessionAttendee getSessionAttendee(MentoringSession session, Long traineeUserId) {
        return sessionAttendeeRepository.findBySession_IdAndMember_TraineeUser_Id(
                        session.getId(), traineeUserId)
                .orElseThrow(() -> new AccessDeniedException("You are not invited to this mentoring session."));
    }

    private void resetSessionAttendeeAcceptances(MentoringSession session) {
        List<MentoringSessionAttendee> attendees = sessionAttendeeRepository.findBySession_Id(session.getId());
        attendees.forEach(attendee -> attendee.setAcceptedScheduledStart(null));
        sessionAttendeeRepository.saveAll(attendees);
    }

    private void updateStatusWhenAllAttendeesAccepted(MentoringSession session) {
        List<MentoringSessionAttendee> attendees = sessionAttendeeRepository.findBySession_Id(session.getId());
        if (!attendees.isEmpty()
                && attendees.stream().allMatch(attendee -> attendee.hasAccepted(session.getScheduledStart()))) {
            session.setStatus(MentoringSessionStatus.SCHEDULED);
        }
    }

    private void commitProposedSchedule(MentoringSession session, Long acceptedByUserId) {
        Instant proposedStart = session.getProposedStart();
        Instant proposedEnd = session.getProposedEnd();
        if (proposedStart == null || proposedEnd == null) {
            throw new BusinessException("INVALID_STATE", "There is no proposed time to accept.", HttpStatus.BAD_REQUEST);
        }

        Long proposalAuthorId = session.getProposedByUserId();
        session.setScheduledStart(proposedStart);
        session.setScheduledEnd(proposedEnd);
        session.setProposedStart(null);
        session.setProposedEnd(null);
        session.setProposedByUserId(null);
        session.setRescheduleReason(null);
        session.setStatus(MentoringSessionStatus.PENDING);
        resetSessionAttendeeAcceptances(session);

        Long attendeeToAccept = acceptedByUserId;
        if (isSessionMentor(session, acceptedByUserId)) {
            attendeeToAccept = proposalAuthorId;
        }
        if (attendeeToAccept != null) {
            sessionAttendeeRepository.findBySession_IdAndMember_TraineeUser_Id(
                    session.getId(), attendeeToAccept)
                    .ifPresent(attendee -> attendee.setAcceptedScheduledStart(proposedStart));
        }
        updateStatusWhenAllAttendeesAccepted(session);
        reservationService.reschedule("MENTORING", session.getId(), proposedStart, proposedEnd);
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
