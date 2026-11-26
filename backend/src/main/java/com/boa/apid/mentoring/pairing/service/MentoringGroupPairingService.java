package com.boa.apid.mentoring.pairing.service;

import com.boa.apid.common.exception.BusinessException;
import com.boa.apid.common.exception.ResourceNotFoundException;
import com.boa.apid.core.auth.security.ApidUserPrincipal;
import com.boa.apid.core.authorization.entity.User;
import com.boa.apid.core.authorization.repository.UserRepository;
import com.boa.apid.core.organization.entity.Employee;
import com.boa.apid.core.organization.repository.EmployeeRepository;
import com.boa.apid.core.scheduling.dto.CreateReservationCommand;
import com.boa.apid.core.scheduling.entity.ParticipationRole;
import com.boa.apid.core.scheduling.service.ScheduleReservationService;
import com.boa.apid.mentoring.pairing.dto.CreateGroupPairingRequest;
import com.boa.apid.mentoring.pairing.dto.CreateGroupSessionRequest;
import com.boa.apid.mentoring.pairing.dto.GroupPairingDto;
import com.boa.apid.mentoring.pairing.dto.MentoringSessionDto;
import com.boa.apid.mentoring.pairing.dto.MentoringSessionParticipantDto;
import com.boa.apid.mentoring.pairing.entity.MentoringDeliveryMode;
import com.boa.apid.mentoring.pairing.entity.MentoringGroupPairingSource;
import com.boa.apid.mentoring.pairing.entity.MentoringRelationship;
import com.boa.apid.mentoring.pairing.entity.MentoringRelationshipMember;
import com.boa.apid.mentoring.pairing.entity.MentoringRelationshipMemberStatus;
import com.boa.apid.mentoring.pairing.entity.MentoringRelationshipStatus;
import com.boa.apid.mentoring.pairing.entity.MentoringRequest;
import com.boa.apid.mentoring.pairing.entity.MentoringRequestRecipient;
import com.boa.apid.mentoring.pairing.entity.MentoringRequestRecipientStatus;
import com.boa.apid.mentoring.pairing.entity.MentoringRequestType;
import com.boa.apid.mentoring.pairing.entity.MentoringSession;
import com.boa.apid.mentoring.pairing.entity.MentoringSessionAttendee;
import com.boa.apid.mentoring.pairing.entity.MentoringSessionStatus;
import com.boa.apid.mentoring.pairing.entity.MentoringSessionTarget;
import com.boa.apid.mentoring.pairing.repository.MentoringGroupPairingSourceRepository;
import com.boa.apid.mentoring.pairing.repository.MentoringRelationshipMemberRepository;
import com.boa.apid.mentoring.pairing.repository.MentoringRelationshipRepository;
import com.boa.apid.mentoring.pairing.repository.MentoringRequestRecipientRepository;
import com.boa.apid.mentoring.pairing.repository.MentoringRequestRepository;
import com.boa.apid.mentoring.pairing.repository.MentoringSessionRepository;
import com.boa.apid.mentoring.pairing.repository.MentoringSessionAttendeeRepository;
import com.boa.apid.mentoring.pairing.repository.MentoringSessionTargetRepository;
import com.boa.apid.platform.video.api.MeetingRoomDetails;
import com.boa.apid.platform.video.api.VideoMeetingProvider;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
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
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

@Service
public class MentoringGroupPairingService {

    @PersistenceContext
    private EntityManager entityManager;

    private final MentoringRelationshipRepository relationshipRepository;
    private final MentoringRelationshipMemberRepository memberRepository;
    private final MentoringRequestRepository requestRepository;
    private final MentoringRequestRecipientRepository recipientRepository;
    private final MentoringGroupPairingSourceRepository groupPairingSourceRepository;
    private final MentoringSessionRepository sessionRepository;
    private final MentoringSessionTargetRepository sessionTargetRepository;
    private final MentoringSessionAttendeeRepository sessionAttendeeRepository;
    private final UserRepository userRepository;
    private final EmployeeRepository employeeRepository;
    private final ScheduleReservationService reservationService;
    private final VideoMeetingProvider videoMeetingProvider;

    public MentoringGroupPairingService(
            MentoringRelationshipRepository relationshipRepository,
            MentoringRelationshipMemberRepository memberRepository,
            MentoringRequestRepository requestRepository,
            MentoringRequestRecipientRepository recipientRepository,
            MentoringGroupPairingSourceRepository groupPairingSourceRepository,
            MentoringSessionRepository sessionRepository,
            MentoringSessionTargetRepository sessionTargetRepository,
            MentoringSessionAttendeeRepository sessionAttendeeRepository,
            UserRepository userRepository,
            EmployeeRepository employeeRepository,
            ScheduleReservationService reservationService,
            VideoMeetingProvider videoMeetingProvider
    ) {
        this.relationshipRepository = relationshipRepository;
        this.memberRepository = memberRepository;
        this.requestRepository = requestRepository;
        this.recipientRepository = recipientRepository;
        this.groupPairingSourceRepository = groupPairingSourceRepository;
        this.sessionRepository = sessionRepository;
        this.sessionTargetRepository = sessionTargetRepository;
        this.sessionAttendeeRepository = sessionAttendeeRepository;
        this.userRepository = userRepository;
        this.employeeRepository = employeeRepository;
        this.reservationService = reservationService;
        this.videoMeetingProvider = videoMeetingProvider;
    }

    // -------------------------------------------------------------------------
    // CREATE GROUP PAIRING
    // -------------------------------------------------------------------------

    @Transactional
    public GroupPairingDto createGroupPairing(CreateGroupPairingRequest body, ApidUserPrincipal actor) {
        if (body == null || body.sourceRelationshipIds() == null || body.sourceRelationshipIds().size() < 2) {
            throw new BusinessException(
                    "GROUP_PAIRING_MIN_SIZE",
                    "Select at least 2 active 1-on-1 pairings to create a group cohort.",
                    HttpStatus.BAD_REQUEST
            );
        }

        List<Long> distinctIds = body.sourceRelationshipIds().stream().distinct().toList();
        if (distinctIds.size() < 2) {
            throw new BusinessException("GROUP_PAIRING_DUPLICATE", "Source pairings must be distinct.", HttpStatus.BAD_REQUEST);
        }

        User mentor = userRepository.findById(actor.getUserId())
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));

        List<MentoringRelationship> sources = new ArrayList<>();
        for (Long sourceId : distinctIds) {
            MentoringRelationship rel = relationshipRepository.findDetailedById(sourceId)
                    .orElseThrow(() -> new ResourceNotFoundException("Mentoring relationship " + sourceId + " not found"));
            if (!rel.getMentorUser().getId().equals(actor.getUserId())) {
                throw new AccessDeniedException("You can only group your own pairings.");
            }
            if (rel.getStatus() != MentoringRelationshipStatus.ACTIVE) {
                throw new BusinessException("GROUP_PAIRING_INACTIVE_SOURCE",
                        "All selected pairings must be active. Pairing " + sourceId + " is " + rel.getStatus() + ".",
                        HttpStatus.CONFLICT);
            }
            if (rel.getRequest().getRequestType() != MentoringRequestType.INDIVIDUAL) {
                throw new BusinessException("GROUP_PAIRING_NOT_INDIVIDUAL",
                        "Only individual (1-on-1) pairings can be grouped. Pairing " + sourceId + " is already a group.",
                        HttpStatus.CONFLICT);
            }
            sources.add(rel);
        }

        List<MentoringRelationshipMember> allSourceMembers = new ArrayList<>();
        for (MentoringRelationship source : sources) {
            List<MentoringRelationshipMember> activeMembers =
                    memberRepository.findByRelationship_IdOrderByJoinedAtAsc(source.getId()).stream()
                            .filter(m -> m.getStatus() == MentoringRelationshipMemberStatus.ACTIVE)
                            .toList();
            if (activeMembers.isEmpty()) {
                throw new BusinessException("GROUP_PAIRING_NO_ACTIVE_MEMBERS",
                        "Pairing " + source.getId() + " has no active members.", HttpStatus.CONFLICT);
            }
            allSourceMembers.addAll(activeMembers);
        }

        Set<Long> traineeIds = new HashSet<>();
        for (MentoringRelationshipMember m : allSourceMembers) {
            if (!traineeIds.add(m.getTraineeUser().getId())) {
                throw new BusinessException("GROUP_PAIRING_DUPLICATE_TRAINEE",
                        "The same trainee appears in multiple selected pairings.", HttpStatus.CONFLICT);
            }
        }

        var skillSet = sources.stream()
                .map(r -> r.getRequest().getSkill() == null ? null : r.getRequest().getSkill().getId())
                .collect(Collectors.toSet());
        var sharedSkill = (skillSet.size() == 1) ? sources.get(0).getRequest().getSkill() : null;

        // Create GROUP request + relationship
        MentoringRequest groupRequest = new MentoringRequest();
        groupRequest.setMentorUser(mentor);
        groupRequest.setInitiatedByUser(mentor);
        groupRequest.setRequestType(MentoringRequestType.GROUP);
        groupRequest.setSkill(sharedSkill);
        groupRequest.setMessage("Group cohort created from " + distinctIds.size() + " individual pairings.");
        groupRequest = requestRepository.save(groupRequest);

        MentoringRelationship groupRelationship = new MentoringRelationship();
        groupRelationship.setRequest(groupRequest);
        groupRelationship.setMentorUser(mentor);
        groupRelationship.setStatus(MentoringRelationshipStatus.ACTIVE);
        groupRelationship = relationshipRepository.save(groupRelationship);

        // Record sources and REASSIGN them (hides from lists, preserves data)
        Instant now = Instant.now();
        for (MentoringRelationship source : sources) {
            MentoringGroupPairingSource pairingSource = new MentoringGroupPairingSource();
            pairingSource.setGroupRelationship(groupRelationship);
            pairingSource.setSourceRelationship(source);
            groupPairingSourceRepository.save(pairingSource);

            memberRepository.findByRelationship_IdOrderByJoinedAtAsc(source.getId()).forEach(m -> {
                if (m.getStatus() == MentoringRelationshipMemberStatus.ACTIVE) {
                    m.setStatus(MentoringRelationshipMemberStatus.CANCELLED);
                    m.setEndedAt(now);
                    memberRepository.save(m);
                }
            });

            source.setStatus(MentoringRelationshipStatus.REASSIGNED);
            source.setEndedAt(now);
            relationshipRepository.save(source);
        }

        // Flush CANCELLED updates before inserting new ACTIVE group members
        // (avoids uq_active_mentoring_pair_skill constraint violation)
        entityManager.flush();

        // Create group members
        Map<Long, Employee> empByUserId = new LinkedHashMap<>();
        employeeRepository.findDetailedByUserIdIn(
                allSourceMembers.stream().map(m -> m.getTraineeUser().getId()).toList()
        ).forEach(e -> empByUserId.put(e.getUserId(), e));

        List<GroupPairingDto.GroupMemberDto> memberDtos = new ArrayList<>();
        for (MentoringRelationshipMember sourceM : allSourceMembers) {
            MentoringRequestRecipient recipient = new MentoringRequestRecipient();
            recipient.setRequest(groupRequest);
            recipient.setRecipientUser(sourceM.getTraineeUser());
            recipient.setTraineeUser(sourceM.getTraineeUser());
            recipient.setStatus(MentoringRequestRecipientStatus.ACCEPTED);
            recipient.setRespondedAt(now);
            recipient = recipientRepository.save(recipient);

            MentoringRelationshipMember groupMember = new MentoringRelationshipMember();
            groupMember.setRelationship(groupRelationship);
            groupMember.setRequestRecipient(recipient);
            groupMember.setMentorUser(mentor);
            groupMember.setTraineeUser(sourceM.getTraineeUser());
            groupMember.setSkill(sourceM.getSkill() != null ? sourceM.getSkill() : sharedSkill);
            groupMember.setStatus(MentoringRelationshipMemberStatus.ACTIVE);
            groupMember = memberRepository.save(groupMember);

            Employee emp = empByUserId.get(sourceM.getTraineeUser().getId());
            memberDtos.add(new GroupPairingDto.GroupMemberDto(
                    groupMember.getId(),
                    sourceM.getTraineeUser().getId(),
                    emp != null ? emp.getFullName() : sourceM.getTraineeUser().getUsername(),
                    "ACTIVE"
            ));
        }

        Employee mentorEmp = employeeRepository.findByUserId(mentor.getId()).orElse(null);
        return new GroupPairingDto(
                groupRelationship.getId(),
                MentoringRelationshipStatus.ACTIVE,
                mentor.getId(),
                mentorEmp != null ? mentorEmp.getFullName() : mentor.getUsername(),
                sharedSkill != null ? sharedSkill.getName() : null,
                groupRelationship.getStartedAt(),
                memberDtos,
                distinctIds
        );
    }

    // -------------------------------------------------------------------------
    // DISBAND GROUP PAIRING
    // -------------------------------------------------------------------------

    @Transactional
    public void disbandGroupPairing(Long groupRelationshipId, ApidUserPrincipal actor) {
        MentoringRelationship group = relationshipRepository.findDetailedById(groupRelationshipId)
                .orElseThrow(() -> new ResourceNotFoundException("Group pairing not found."));

        if (!group.getMentorUser().getId().equals(actor.getUserId())) {
            throw new AccessDeniedException("Only the mentor can disband this group.");
        }
        if (group.getRequest().getRequestType() != MentoringRequestType.GROUP) {
            throw new BusinessException("NOT_A_GROUP_PAIRING",
                    "This relationship is not a group pairing.", HttpStatus.BAD_REQUEST);
        }
        if (group.getStatus() != MentoringRelationshipStatus.ACTIVE) {
            throw new BusinessException("GROUP_PAIRING_NOT_ACTIVE",
                    "Only an active group pairing can be disbanded.", HttpStatus.CONFLICT);
        }

        List<Long> sourceIds = groupPairingSourceRepository
                .findSourceRelationshipIdsByGroupRelationshipId(groupRelationshipId);
        if (sourceIds.isEmpty()) {
            throw new BusinessException("GROUP_PAIRING_NO_SOURCES",
                    "No source pairings found for this group.", HttpStatus.CONFLICT);
        }

        // Close group members and the group relationship
        Instant now = Instant.now();
        memberRepository.findByRelationship_IdOrderByJoinedAtAsc(groupRelationshipId).forEach(m -> {
            if (m.getStatus() == MentoringRelationshipMemberStatus.ACTIVE) {
                m.setStatus(MentoringRelationshipMemberStatus.CANCELLED);
                m.setEndedAt(now);
                memberRepository.save(m);
            }
        });
        group.setStatus(MentoringRelationshipStatus.CANCELLED);
        group.setEndedAt(now);
        relationshipRepository.save(group);

        // Flush so the unique index sees the group members as CANCELLED
        entityManager.flush();

        // Restore each source relationship and its members to ACTIVE
        for (Long sourceId : sourceIds) {
            MentoringRelationship source = relationshipRepository.findByIdForUpdate(sourceId)
                    .orElseThrow(() -> new ResourceNotFoundException("Source relationship " + sourceId + " not found."));

            source.setStatus(MentoringRelationshipStatus.ACTIVE);
            source.setEndedAt(null);
            relationshipRepository.save(source);

            memberRepository.findByRelationship_IdOrderByJoinedAtAsc(sourceId).forEach(m -> {
                if (m.getStatus() == MentoringRelationshipMemberStatus.CANCELLED) {
                    m.setStatus(MentoringRelationshipMemberStatus.ACTIVE);
                    m.setEndedAt(null);
                    memberRepository.save(m);
                }
            });
        }
    }

    // -------------------------------------------------------------------------
    // CREATE GROUP SESSION
    // -------------------------------------------------------------------------

    @Transactional
    public MentoringSessionDto createGroupSession(CreateGroupSessionRequest body, ApidUserPrincipal actor) {
        // Validate participants
        if (body == null || body.participantTraineeUserIds() == null
                || body.participantTraineeUserIds().size() < 2) {
            throw new BusinessException("GROUP_SESSION_MIN_PARTICIPANTS",
                    "A group session requires at least 2 trainees.", HttpStatus.BAD_REQUEST);
        }

        List<Long> distinctTraineeIds = body.participantTraineeUserIds().stream().distinct().toList();
        if (distinctTraineeIds.size() < 2) {
            throw new BusinessException("GROUP_SESSION_DUPLICATE_PARTICIPANTS",
                    "Trainee participants must be distinct.", HttpStatus.BAD_REQUEST);
        }

        // Validate session fields
        if (body.title() == null || body.title().isBlank()) {
            throw new BusinessException("MENTORING_SESSION_TITLE_REQUIRED", "Enter a session title.");
        }
        if (body.title().trim().length() > 180) {
            throw new BusinessException("MENTORING_SESSION_TITLE_TOO_LONG", "Session titles cannot exceed 180 characters.");
        }
        if (body.scheduledStart() == null || body.scheduledEnd() == null
                || !body.scheduledStart().isAfter(Instant.now())
                || !body.scheduledEnd().isAfter(body.scheduledStart())) {
            throw new BusinessException("INVALID_MENTORING_SESSION_TIME",
                    "Choose a future start time and an end time after the start.");
        }
        ZoneId eat = ZoneId.of("Africa/Addis_Ababa");
        if (body.scheduledStart().atZone(eat).getDayOfWeek() == DayOfWeek.SUNDAY) {
            throw new BusinessException("SUNDAY_NOT_ALLOWED",
                    "Bank policy prohibits scheduling sessions on Sundays.", HttpStatus.BAD_REQUEST);
        }
        if (body.deliveryMode() == null) {
            throw new BusinessException("MENTORING_DELIVERY_MODE_REQUIRED", "Choose a delivery mode.");
        }

        // Find each trainee's active 1-on-1 membership with this mentor
        List<MentoringRelationshipMember> participantMembers = new ArrayList<>();
        for (Long traineeUserId : distinctTraineeIds) {
            // Find an active member row where mentor = actor and trainee = this traineeUserId
            // across any ACTIVE INDIVIDUAL relationship
            MentoringRelationshipMember member = memberRepository
                    .findActiveIndividualMemberByMentorAndTrainee(actor.getUserId(), traineeUserId)
                    .orElseThrow(() -> new BusinessException("GROUP_SESSION_INVALID_PARTICIPANT",
                            "User " + traineeUserId + " is not an active 1-on-1 trainee of yours.",
                            HttpStatus.BAD_REQUEST));
            participantMembers.add(member);
        }

        // Use the first participant's relationship as the "anchor" for the session record
        // (the session entity requires a relationship_id; we use the mentor's first active 1-on-1)
        MentoringRelationship anchorRelationship = participantMembers.get(0).getRelationship();

        // Provision video room if needed
        String meetingUrl = body.meetingUrl() != null && !body.meetingUrl().isBlank()
                ? body.meetingUrl().trim() : null;
        String roomName = null;
        if ((body.deliveryMode() == MentoringDeliveryMode.ONLINE
                || body.deliveryMode() == MentoringDeliveryMode.HYBRID)
                && meetingUrl == null) {
            String prefix = "mentoring-grp-" + actor.getUserId();
            Instant expiry = body.scheduledEnd().plus(Duration.ofHours(3));
            MeetingRoomDetails room = videoMeetingProvider.createRoom(prefix, expiry);
            roomName = room.roomName();
            meetingUrl = room.roomUrl();
        }

        // Save the session
        User mentorUser = userRepository.findById(actor.getUserId())
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));
        MentoringSession session = new MentoringSession();
        session.setRelationship(anchorRelationship);
        session.setTargetTraineeMember(null);   // group session — no single target
        session.setGroupSession(true);
        session.setTitle(body.title().trim());
        session.setAgenda(body.agenda() != null && !body.agenda().isBlank() ? body.agenda().trim() : null);
        session.setScheduledStart(body.scheduledStart());
        session.setScheduledEnd(body.scheduledEnd());
        session.setDeliveryMode(body.deliveryMode());
        session.setMeetingUrl(meetingUrl);
        session.setMeetingRoomName(roomName);
        session.setMeetingRoomUrl(meetingUrl);
        session.setMeetingProvider(videoMeetingProvider.getProviderName());
        session.setLocation(body.location() != null && !body.location().isBlank() ? body.location().trim() : null);
        session.setStatus(MentoringSessionStatus.PENDING);
        session.setCreatedByUser(mentorUser);
        session = sessionRepository.save(session);

        // Save targets — one row per participant, pointing to their individual member record
        for (MentoringRelationshipMember member : participantMembers) {
            MentoringSessionTarget target = new MentoringSessionTarget();
            target.setSession(session);
            target.setMember(member);
            sessionTargetRepository.save(target);

            MentoringSessionAttendee attendee = new MentoringSessionAttendee();
            attendee.setSession(session);
            attendee.setMember(member);
            sessionAttendeeRepository.save(attendee);
        }

        // Register calendar reservations for all participants
        List<CreateReservationCommand.ParticipantReservationInput> participants = new ArrayList<>();
        employeeRepository.findByUserId(actor.getUserId())
                .ifPresent(e -> participants.add(
                        new CreateReservationCommand.ParticipantReservationInput(e.getId(), ParticipationRole.MENTOR)));
        for (MentoringRelationshipMember m : participantMembers) {
            employeeRepository.findByUserId(m.getTraineeUser().getId())
                    .ifPresent(e -> participants.add(
                            new CreateReservationCommand.ParticipantReservationInput(e.getId(), ParticipationRole.MENTEE)));
        }
        if (!participants.isEmpty()) {
            reservationService.reserve(new CreateReservationCommand(
                    "MENTORING",
                    session.getId(),
                    session.getTitle(),
                    session.getScheduledStart(),
                    session.getScheduledEnd(),
                    "Africa/Addis_Ababa",
                    session.getDeliveryMode().name(),
                    session.getLocation(),
                    session.getMeetingUrl(),
                    participants
            ));
        }

        // Build DTO
        List<Long> targetUserIds = participantMembers.stream()
                .map(m -> m.getTraineeUser().getId()).toList();
        Map<Long, Employee> empMap = new LinkedHashMap<>();
        employeeRepository.findDetailedByUserIdIn(targetUserIds).forEach(e -> empMap.put(e.getUserId(), e));
        Employee mentorEmp = employeeRepository.findByUserId(actor.getUserId()).orElse(null);
        String mentorName = mentorEmp != null ? mentorEmp.getFullName() : mentorUser.getUsername();
        List<MentoringSessionParticipantDto> targetTrainees = participantMembers.stream()
                .map(member -> {
                    Long traineeUserId = member.getTraineeUser().getId();
                    Employee employee = empMap.get(traineeUserId);
                    String traineeName = employee != null
                            ? employee.getFullName()
                            : member.getTraineeUser().getUsername();
                    return new MentoringSessionParticipantDto(traineeUserId, traineeName);
                })
                .toList();

        return new MentoringSessionDto(
                session.getId(),
                anchorRelationship.getId(),
                null,
                null,
                session.getTitle(),
                session.getAgenda(),
                session.getScheduledStart(),
                session.getScheduledEnd(),
                session.getDeliveryMode(),
                session.getMeetingUrl(),
                session.getLocation(),
                session.getStatus(),
                actor.getUserId(),
                mentorName,
                null, null, null, null, null, null, null,
                session.getCreatedAt(),
                "GROUP_SESSION",
                targetUserIds,
                true,
                targetTrainees,
                null,
                false,
                0,
                participantMembers.size()
        );
    }
}
