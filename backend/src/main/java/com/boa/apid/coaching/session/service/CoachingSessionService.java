package com.boa.apid.coaching.session.service;

import com.boa.apid.coaching.assignment.entity.AssignmentPathway;
import com.boa.apid.coaching.assignment.entity.AssignmentStatus;
import com.boa.apid.coaching.assignment.entity.CoachingAssignment;
import com.boa.apid.coaching.assignment.repository.CoachingAssignmentRepository;
import com.boa.apid.coaching.importpms.entity.PmsGoalLine;
import com.boa.apid.coaching.importpms.repository.PmsGoalLineRepository;
import com.boa.apid.coaching.session.dto.*;
import com.boa.apid.coaching.session.entity.*;
import com.boa.apid.coaching.session.repository.CoachingSessionRepository;
import com.boa.apid.coaching.session.repository.SessionParticipantRepository;
import com.boa.apid.coaching.session.repository.SessionScheduleProposalRepository;
import com.boa.apid.coaching.session.video.MeetingRoomDetails;
import com.boa.apid.coaching.session.video.MeetingTokenDetails;
import com.boa.apid.coaching.session.video.VideoMeetingProvider;
import com.boa.apid.coaching.skillrequest.entity.SkillCoachingRequest;
import com.boa.apid.coaching.skillrequest.entity.SkillCoachingRequestStatus;
import com.boa.apid.coaching.skillrequest.entity.SkillCoachingRequestTarget;
import com.boa.apid.coaching.skillrequest.repository.SkillCoachingRequestRepository;
import com.boa.apid.coaching.skillrequest.repository.SkillCoachingRequestTargetRepository;
import com.boa.apid.common.exception.BusinessException;
import com.boa.apid.common.exception.ResourceNotFoundException;
import com.boa.apid.core.audit.service.AuditService;
import com.boa.apid.core.auth.security.ApidUserPrincipal;
import com.boa.apid.core.organization.dto.EmployeeDto;
import com.boa.apid.core.organization.entity.Employee;
import com.boa.apid.core.organization.repository.EmployeeRepository;
import com.boa.apid.core.organization.service.EmployeeQueryService;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class CoachingSessionService {

    private final CoachingSessionRepository sessionRepository;
    private final SessionParticipantRepository participantRepository;
    private final SessionScheduleProposalRepository proposalRepository;
    private final CoachingAssignmentRepository assignmentRepository;
    private final SkillCoachingRequestRepository skillRequestRepository;
    private final SkillCoachingRequestTargetRepository skillRequestTargetRepository;
    private final PmsGoalLineRepository goalLineRepository;
    private final EmployeeRepository employeeRepository;
    private final EmployeeQueryService employeeQueryService;
    private final VideoMeetingProvider videoMeetingProvider;
    private final AuditService auditService;

    public CoachingSessionService(
            CoachingSessionRepository sessionRepository,
            SessionParticipantRepository participantRepository,
            SessionScheduleProposalRepository proposalRepository,
            CoachingAssignmentRepository assignmentRepository,
            SkillCoachingRequestRepository skillRequestRepository,
            SkillCoachingRequestTargetRepository skillRequestTargetRepository,
            PmsGoalLineRepository goalLineRepository,
            EmployeeRepository employeeRepository,
            EmployeeQueryService employeeQueryService,
            VideoMeetingProvider videoMeetingProvider,
            AuditService auditService
    ) {
        this.sessionRepository = sessionRepository;
        this.participantRepository = participantRepository;
        this.proposalRepository = proposalRepository;
        this.assignmentRepository = assignmentRepository;
        this.skillRequestRepository = skillRequestRepository;
        this.skillRequestTargetRepository = skillRequestTargetRepository;
        this.goalLineRepository = goalLineRepository;
        this.employeeRepository = employeeRepository;
        this.employeeQueryService = employeeQueryService;
        this.videoMeetingProvider = videoMeetingProvider;
        this.auditService = auditService;
    }

    // ─────────────────────────── 1. CREATE SESSION ───────────────────────────

    @Transactional
    public CoachingSessionDto createSession(CreateSessionRequest request, ApidUserPrincipal actor) {
        EmployeeDto callerEmp = getCallerEmployeeOrThrow(actor);
        boolean isAdmin = isAdmin(actor);

        // Parent validation: exactly one parent must be specified
        boolean hasAssignment = request.assignmentId() != null;
        boolean hasSkillReq = request.skillRequestId() != null;
        if ((hasAssignment && hasSkillReq) || (!hasAssignment && !hasSkillReq)) {
            throw new BusinessException("INVALID_PARENT", "A session must link to either a coaching assignment or a skill request, not both or neither.");
        }

        Instant startTime = request.scheduledStartTime();
        int duration = request.durationMinutes();
        Instant endTime = startTime.plus(Duration.ofMinutes(duration));

        if (startTime.isBefore(Instant.now().minus(Duration.ofMinutes(5)))) {
            throw new BusinessException("INVALID_START_TIME", "Cannot schedule a coaching session in the past.");
        }

        Long coachEmpId;
        AssignmentPathway pathway;
        List<Long> coacheeEmpIds = new ArrayList<>();

        if (hasAssignment) {
            CoachingAssignment assignment = assignmentRepository.findById(request.assignmentId())
                    .orElseThrow(() -> new ResourceNotFoundException("Coaching assignment not found"));

            if (assignment.getStatus() == AssignmentStatus.CLOSED) {
                throw new BusinessException("ASSIGNMENT_INACTIVE", "Cannot schedule sessions for a closed coaching assignment.");
            }

            coachEmpId = assignment.getCoachEmployeeId();
            if (coachEmpId == null) {
                throw new BusinessException("NO_COACH_ASSIGNED", "A coach has not been designated for this assignment yet.");
            }

            boolean isCoach = callerEmp.id().equals(coachEmpId);
            boolean isCoachee = callerEmp.id().equals(assignment.getCoacheeEmployeeId());
            if (!isAdmin && !isCoach && !isCoachee) {
                throw new AccessDeniedException("You are not an authorized participant in this coaching assignment.");
            }

            pathway = AssignmentPathway.MANDATORY_PMS;
            coacheeEmpIds.add(assignment.getCoacheeEmployeeId());
        } else {
            SkillCoachingRequest skillReq = skillRequestRepository.findById(request.skillRequestId())
                    .orElseThrow(() -> new ResourceNotFoundException("Skill coaching request not found"));

            if (skillReq.getStatus() != SkillCoachingRequestStatus.APPROVED) {
                throw new BusinessException("REQUEST_NOT_APPROVED", "Cannot schedule sessions for a skill request that has not been approved by PMS.");
            }

            coachEmpId = skillReq.getProposedCoachEmployeeId();
            if (coachEmpId == null) {
                throw new BusinessException("NO_COACH_DESIGNATED", "No coach is designated on this approved skill request.");
            }

            boolean isCoach = callerEmp.id().equals(coachEmpId);
            if (!isAdmin && !isCoach) {
                throw new AccessDeniedException("Only the designated coach can schedule group skill-development sessions.");
            }

            pathway = AssignmentPathway.SELF_DEVELOPMENT;
            List<SkillCoachingRequestTarget> targets = skillRequestTargetRepository.findAllByRequestId(skillReq.getId());
            if (targets.isEmpty()) {
                throw new BusinessException("EMPTY_COHORT", "Approved skill request has no registered employee targets.");
            }
            targets.forEach(t -> coacheeEmpIds.add(t.getEmployeeId()));
        }

        // Concurrency / double-booking check
        if (sessionRepository.hasOverlappingCoachSession(coachEmpId, startTime, endTime, 0L)) {
            throw new BusinessException("COACH_DOUBLE_BOOKED", "Coach already has another confirmed coaching session during this time window.");
        }

        // Provision Daily.co video room if VIRTUAL_VIDEO
        String dailyRoomName = null;
        String dailyRoomUrl = null;
        if (request.meetingMode() == SessionMeetingMode.VIRTUAL_VIDEO) {
            String prefix = hasAssignment ? "pms-" + request.assignmentId() : "skill-" + request.skillRequestId();
            MeetingRoomDetails room = videoMeetingProvider.createRoom(prefix, endTime.plus(Duration.ofHours(2)));
            dailyRoomName = room.roomName();
            dailyRoomUrl = room.roomUrl();
        }

        CoachingSession session = new CoachingSession();
        session.setAssignmentId(request.assignmentId());
        session.setSkillRequestId(request.skillRequestId());
        session.setCoachEmployeeId(coachEmpId);
        session.setTitle(request.title().trim());
        session.setPathway(pathway);
        session.setScheduledStartTime(startTime);
        session.setScheduledEndTime(endTime);
        session.setDurationMinutes(duration);
        session.setMeetingMode(request.meetingMode());
        session.setMeetingLocation(request.meetingLocation());
        session.setDailyRoomName(dailyRoomName);
        session.setDailyRoomUrl(dailyRoomUrl);
        session.setTargetPmsGoalId(request.targetPmsGoalId());
        session.setCreatedByUserId(actor.getUserId());
        session.setStatus(SessionStatus.CONFIRMED); // Confirmed on proposal by coach

        CoachingSession savedSession = sessionRepository.save(session);

        // Create Coach Participant
        SessionParticipant coachPart = new SessionParticipant();
        coachPart.setSessionId(savedSession.getId());
        coachPart.setEmployeeId(coachEmpId);
        coachPart.setRole(ParticipantRole.COACH);
        coachPart.setInvitationStatus(InvitationStatus.ACCEPTED);
        coachPart.setRespondedAt(Instant.now());
        participantRepository.save(coachPart);

        // Create Coachee Participants
        for (Long coacheeId : coacheeEmpIds) {
            SessionParticipant coacheePart = new SessionParticipant();
            coacheePart.setSessionId(savedSession.getId());
            coacheePart.setEmployeeId(coacheeId);
            coacheePart.setRole(ParticipantRole.COACHEE);
            coacheePart.setInvitationStatus(InvitationStatus.PENDING);
            participantRepository.save(coacheePart);
        }

        auditService.record(new AuditService.AuditCommand(
                null, actor.getUserId(), actor.getUsername(), null,
                "COACHING", "COACHING_SESSION_SCHEDULED", "SUCCESS", null,
                "COACHING_SESSION", savedSession.getId().toString(),
                Map.of("title", savedSession.getTitle(), "mode", savedSession.getMeetingMode().name()),
                null, null
        ));

        return toDto(savedSession);
    }

    // ─────────────────────────── 2. LIST MY SESSIONS ───────────────────────────

    @Transactional(readOnly = true)
    public List<CoachingSessionDto> getMySessions(ApidUserPrincipal actor, Boolean upcomingOnly, AssignmentPathway pathway) {
        EmployeeDto callerEmp = getCallerEmployeeOrThrow(actor);
        List<CoachingSession> sessions;

        if (Boolean.TRUE.equals(upcomingOnly)) {
            sessions = sessionRepository.findUpcomingByParticipantEmployeeId(callerEmp.id(), Instant.now().minus(Duration.ofMinutes(15)));
        } else {
            sessions = sessionRepository.findAllByParticipantEmployeeId(callerEmp.id());
        }

        if (pathway != null) {
            sessions = sessions.stream().filter(s -> s.getPathway() == pathway).toList();
        }

        return sessions.stream().map(this::toDto).toList();
    }

    // ─────────────────────────── 3. GET SESSION DETAIL ───────────────────────────

    @Transactional(readOnly = true)
    public CoachingSessionDto getSessionDetail(Long sessionId, ApidUserPrincipal actor) {
        CoachingSession session = sessionRepository.findById(sessionId)
                .orElseThrow(() -> new ResourceNotFoundException("Coaching session not found"));

        if (!isAdmin(actor)) {
            EmployeeDto callerEmp = getCallerEmployeeOrThrow(actor);
            boolean isParticipant = participantRepository.existsBySessionIdAndEmployeeId(sessionId, callerEmp.id());
            if (!isParticipant) {
                throw new AccessDeniedException("You are not an authorized participant in this session.");
            }
        }

        return toDto(session);
    }

    // ─────────────────────────── 4. RESPOND INVITATION ───────────────────────────

    @Transactional
    public CoachingSessionDto respondInvitation(Long sessionId, RespondInvitationRequest request, ApidUserPrincipal actor) {
        EmployeeDto callerEmp = getCallerEmployeeOrThrow(actor);
        SessionParticipant participant = participantRepository.findBySessionIdAndEmployeeId(sessionId, callerEmp.id())
                .orElseThrow(() -> new AccessDeniedException("You are not a participant in this coaching session."));

        if (request.accept()) {
            participant.setInvitationStatus(InvitationStatus.ACCEPTED);
            participant.setInvitationDeclineReason(null);
        } else {
            String reason = request.declineReason() != null ? request.declineReason().trim() : "";
            if (reason.length() < 5) {
                throw new BusinessException("DECLINE_REASON_REQUIRED", "Please provide a brief reason why you cannot attend this session.");
            }
            participant.setInvitationStatus(InvitationStatus.DECLINED);
            participant.setInvitationDeclineReason(reason);
        }
        participant.setRespondedAt(Instant.now());
        participantRepository.save(participant);

        CoachingSession session = sessionRepository.findById(sessionId).orElseThrow();
        if (request.accept() && session.getStatus() == SessionStatus.PROPOSED) {
            session.setStatus(SessionStatus.CONFIRMED);
            sessionRepository.save(session);
        }

        return toDto(session);
    }

    // ─────────────────────────── 5. PROPOSE RESCHEDULE ───────────────────────────

    @Transactional
    public CoachingSessionDto proposeReschedule(Long sessionId, ProposeRescheduleRequest request, ApidUserPrincipal actor) {
        EmployeeDto callerEmp = getCallerEmployeeOrThrow(actor);
        CoachingSession session = sessionRepository.findById(sessionId)
                .orElseThrow(() -> new ResourceNotFoundException("Coaching session not found"));

        if (session.getStatus() == SessionStatus.COMPLETED || session.getStatus() == SessionStatus.CANCELLED) {
            throw new BusinessException("INVALID_STATE", "Cannot reschedule a completed or cancelled session.");
        }

        boolean isCoach = session.getCoachEmployeeId().equals(callerEmp.id());
        boolean isParticipant = participantRepository.existsBySessionIdAndEmployeeId(sessionId, callerEmp.id());
        if (!isAdmin(actor) && !isParticipant) {
            throw new AccessDeniedException("Only participants can propose rescheduling.");
        }

        long priorProposals = proposalRepository.countBySessionId(sessionId);
        if (priorProposals >= 2) {
            throw new BusinessException("MAX_RESCHEDULES_EXCEEDED", "This session has reached the limit of 2 reschedule requests. Please coordinate directly with your coach.");
        }

        Instant newStart = request.proposedStartTime();
        Instant newEnd = newStart.plus(Duration.ofMinutes(session.getDurationMinutes()));

        // Double booking check for coach
        if (sessionRepository.hasOverlappingCoachSession(session.getCoachEmployeeId(), newStart, newEnd, session.getId())) {
            throw new BusinessException("COACH_DOUBLE_BOOKED", "Coach already has another confirmed session at that proposed time.");
        }

        SessionScheduleProposal proposal = new SessionScheduleProposal();
        proposal.setSessionId(sessionId);
        proposal.setProposedByEmployeeId(callerEmp.id());
        proposal.setProposedStartTime(newStart);
        proposal.setProposedEndTime(newEnd);
        proposal.setReason(request.reason());

        if (isCoach) {
            // Coach owns the cohort schedule: apply immediately and notify participants
            proposal.setStatus(ProposalStatus.ACCEPTED);
            proposal.setRespondedByEmployeeId(callerEmp.id());
            proposal.setRespondedAt(Instant.now());
            proposalRepository.save(proposal);

            session.setScheduledStartTime(newStart);
            session.setScheduledEndTime(newEnd);
            session.setStatus(SessionStatus.CONFIRMED);
            sessionRepository.save(session);

            // Reset coachee RSVPs to PENDING
            List<SessionParticipant> parts = participantRepository.findAllBySessionIdOrderByRoleAsc(sessionId);
            for (SessionParticipant p : parts) {
                if (p.getRole() == ParticipantRole.COACHEE) {
                    p.setInvitationStatus(InvitationStatus.PENDING);
                    participantRepository.save(p);
                }
            }
        } else {
            // Coachee proposed: mark session RESCHEDULE_PENDING for coach review
            proposal.setStatus(ProposalStatus.PENDING);
            proposalRepository.save(proposal);

            session.setStatus(SessionStatus.RESCHEDULE_PENDING);
            sessionRepository.save(session);
        }

        return toDto(session);
    }

    // ─────────────────────────── 6. CANCEL SESSION ───────────────────────────

    @Transactional
    public CoachingSessionDto cancelSession(Long sessionId, CancelSessionRequest request, ApidUserPrincipal actor) {
        EmployeeDto callerEmp = getCallerEmployeeOrThrow(actor);
        CoachingSession session = sessionRepository.findById(sessionId)
                .orElseThrow(() -> new ResourceNotFoundException("Coaching session not found"));

        if (session.getStatus() == SessionStatus.COMPLETED) {
            throw new BusinessException("ALREADY_COMPLETED", "Cannot cancel an already completed session.");
        }

        boolean isParticipant = participantRepository.existsBySessionIdAndEmployeeId(sessionId, callerEmp.id());
        if (!isAdmin(actor) && !isParticipant) {
            throw new AccessDeniedException("Only session participants can cancel this session.");
        }

        session.setStatus(SessionStatus.CANCELLED);
        session.setCancellationReason(request.reason());
        session.setCancelledByEmployeeId(callerEmp.id());
        session.setCancelledAt(Instant.now());
        sessionRepository.save(session);

        auditService.record(new AuditService.AuditCommand(
                null, actor.getUserId(), actor.getUsername(), null,
                "COACHING", "COACHING_SESSION_CANCELLED", "SUCCESS", null,
                "COACHING_SESSION", sessionId.toString(),
                Map.of("reason", request.reason()),
                null, null
        ));

        return toDto(session);
    }

    // ─────────────────────────── 7. COMPLETE SESSION & LOG MINUTES ───────────────────────────

    @Transactional
    public CoachingSessionDto completeSession(Long sessionId, CompleteSessionRequest request, ApidUserPrincipal actor) {
        EmployeeDto callerEmp = getCallerEmployeeOrThrow(actor);
        CoachingSession session = sessionRepository.findById(sessionId)
                .orElseThrow(() -> new ResourceNotFoundException("Coaching session not found"));

        if (session.getStatus() == SessionStatus.CANCELLED) {
            throw new BusinessException("SESSION_CANCELLED", "Cannot log minutes or complete a cancelled session.");
        }

        boolean isCoach = session.getCoachEmployeeId().equals(callerEmp.id());
        if (!isAdmin(actor) && !isCoach) {
            throw new AccessDeniedException("Only the designated coach can complete a session and record official minutes.");
        }

        session.setSessionNotesMinutes(request.sessionNotesMinutes());
        session.setActionItems(request.actionItems());
        session.setStatus(SessionStatus.COMPLETED);
        session.setConductedAt(Instant.now());
        sessionRepository.save(session);

        // Record attendance and assessment per coachee
        Map<Long, SessionParticipant> partMap = participantRepository.findAllBySessionIdOrderByRoleAsc(sessionId)
                .stream().collect(Collectors.toMap(SessionParticipant::getEmployeeId, p -> p));

        for (CompleteSessionRequest.ParticipantAttendanceInput input : request.participantAttendances()) {
            SessionParticipant p = partMap.get(input.employeeId());
            if (p != null) {
                p.setAttendanceStatus(input.attendanceStatus());
                p.setAttendanceMarkedBy(callerEmp.id());
                p.setAttendanceMarkedAt(Instant.now());
                p.setCoachAssessment(input.coachAssessment());
                p.setIndividualNotes(input.individualNotes());
                participantRepository.save(p);
            }
        }

        auditService.record(new AuditService.AuditCommand(
                null, actor.getUserId(), actor.getUsername(), null,
                "COACHING", "COACHING_SESSION_COMPLETED", "SUCCESS", null,
                "COACHING_SESSION", sessionId.toString(),
                Map.of("notesLength", request.sessionNotesMinutes().length()),
                null, null
        ));

        return toDto(session);
    }

    // ─────────────────────────── 8. SUBMIT FEEDBACK ───────────────────────────

    @Transactional
    public CoachingSessionDto submitFeedback(Long sessionId, SubmitFeedbackRequest request, ApidUserPrincipal actor) {
        EmployeeDto callerEmp = getCallerEmployeeOrThrow(actor);
        CoachingSession session = sessionRepository.findById(sessionId)
                .orElseThrow(() -> new ResourceNotFoundException("Coaching session not found"));

        if (session.getStatus() != SessionStatus.COMPLETED) {
            throw new BusinessException("NOT_COMPLETED", "Feedback can only be submitted after the coaching session is completed.");
        }

        SessionParticipant participant = participantRepository.findBySessionIdAndEmployeeId(sessionId, callerEmp.id())
                .orElseThrow(() -> new AccessDeniedException("You are not a participant in this coaching session."));

        participant.setFeedbackRating(request.rating());
        participant.setFeedbackComment(request.comment());
        participant.setFeedbackSubmittedAt(Instant.now());
        participantRepository.save(participant);

        return toDto(session);
    }

    // ─────────────────────────── 8.1 SUBMIT COACHEE PROGRESS ───────────────────────────

    @Transactional
    public CoachingSessionDto submitCoacheeProgress(Long sessionId, SubmitProgressReportRequest request, ApidUserPrincipal actor) {
        EmployeeDto callerEmp = getCallerEmployeeOrThrow(actor);
        CoachingSession session = sessionRepository.findById(sessionId)
                .orElseThrow(() -> new ResourceNotFoundException("Coaching session not found"));

        SessionParticipant participant = participantRepository.findBySessionIdAndEmployeeId(sessionId, callerEmp.id())
                .orElseThrow(() -> new AccessDeniedException("You are not a participant in this coaching session."));

        if (participant.getRole() != ParticipantRole.COACHEE && !isAdmin(actor)) {
            throw new AccessDeniedException("Only coachee participants can submit a progress reflection.");
        }

        participant.setCoacheeProgressNotes(request.progressNotes().trim());
        participant.setCoacheeProgressSubmittedAt(Instant.now());
        participantRepository.save(participant);

        return toDto(session);
    }

    // ─────────────────────────── 8.2 RESPOND RESCHEDULE PROPOSAL (COACH) ───────────────────────────

    @Transactional
    public CoachingSessionDto respondRescheduleProposal(Long sessionId, Long proposalId, RespondRescheduleProposalRequest request, ApidUserPrincipal actor) {
        EmployeeDto callerEmp = getCallerEmployeeOrThrow(actor);
        CoachingSession session = sessionRepository.findById(sessionId)
                .orElseThrow(() -> new ResourceNotFoundException("Coaching session not found"));

        boolean isCoach = session.getCoachEmployeeId().equals(callerEmp.id());
        if (!isAdmin(actor) && !isCoach) {
            throw new AccessDeniedException("Only the designated coach can accept or reject reschedule requests.");
        }

        SessionScheduleProposal proposal = proposalRepository.findById(proposalId)
                .orElseThrow(() -> new ResourceNotFoundException("Reschedule proposal not found"));

        if (!proposal.getSessionId().equals(sessionId)) {
            throw new BusinessException("MISMATCH", "Proposal does not belong to this session.");
        }

        if (proposal.getStatus() != ProposalStatus.PENDING) {
            throw new BusinessException("ALREADY_RESPONDED", "This reschedule proposal has already been answered.");
        }

        proposal.setRespondedByEmployeeId(callerEmp.id());
        proposal.setRespondedAt(Instant.now());

        if (request.accept()) {
            proposal.setStatus(ProposalStatus.ACCEPTED);
            session.setScheduledStartTime(proposal.getProposedStartTime());
            session.setScheduledEndTime(proposal.getProposedEndTime());
            session.setStatus(SessionStatus.CONFIRMED);
        } else {
            proposal.setStatus(ProposalStatus.REJECTED);
            session.setStatus(SessionStatus.CONFIRMED);
        }
        proposalRepository.save(proposal);
        sessionRepository.save(session);

        return toDto(session);
    }

    @Transactional
    public CoachingSessionDto respondPendingReschedule(Long sessionId, RespondRescheduleProposalRequest request, ApidUserPrincipal actor) {
        SessionScheduleProposal proposal = proposalRepository
                .findFirstBySessionIdAndStatusOrderByCreatedAtDesc(sessionId, ProposalStatus.PENDING)
                .orElseThrow(() -> new BusinessException("NO_PENDING_PROPOSAL", "There are no pending reschedule requests for this session."));
        return respondRescheduleProposal(sessionId, proposal.getId(), request, actor);
    }

    // ─────────────────────────── 9. GET JOIN TOKEN (DAILY.CO) ───────────────────────────

    @Transactional(readOnly = true)
    public SessionJoinTokenDto getJoinToken(Long sessionId, ApidUserPrincipal actor) {
        EmployeeDto callerEmp = getCallerEmployeeOrThrow(actor);
        CoachingSession session = sessionRepository.findById(sessionId)
                .orElseThrow(() -> new ResourceNotFoundException("Coaching session not found"));

        if (session.getMeetingMode() != SessionMeetingMode.VIRTUAL_VIDEO) {
            throw new BusinessException("NOT_A_VIDEO_SESSION", "This coaching session is configured for phone or in-person delivery, not video.");
        }

        SessionParticipant participant = participantRepository.findBySessionIdAndEmployeeId(sessionId, callerEmp.id())
                .orElseThrow(() -> new AccessDeniedException("You are not authorized to join this coaching video call."));

        boolean isCoach = participant.getRole() == ParticipantRole.COACH;
        String roomName = session.getDailyRoomName();
        if (roomName == null || roomName.isBlank()) {
            roomName = "session-" + session.getId();
        }

        MeetingTokenDetails tokenDetails = videoMeetingProvider.createParticipantToken(
                roomName,
                callerEmp.employeeNumber(),
                callerEmp.fullName(),
                isCoach,
                session.getScheduledEndTime().plus(Duration.ofHours(2))
        );

        return new SessionJoinTokenDto(
                roomName,
                tokenDetails.token(),
                tokenDetails.roomUrlWithToken(),
                tokenDetails.expiresAt(),
                tokenDetails.isMock()
        );
    }

    // ─────────────────────────── HELPERS ───────────────────────────

    private CoachingSessionDto toDto(CoachingSession s) {
        Employee coach = employeeRepository.findById(s.getCoachEmployeeId()).orElse(null);
        String coachEmpNo = coach != null ? coach.getEmployeeNumber() : null;
        String coachName = coach != null ? coach.getFullName() : null;
        String coachJob = coach != null ? (coach.getPosition() != null ? coach.getPosition() : coach.getJob()) : null;
        String coachDept = coach != null ? (coach.getDepartment() != null ? coach.getDepartment().getName() : coach.getDepartmentName()) : null;

        String goalName = null;
        if (s.getTargetPmsGoalId() != null) {
            goalName = goalLineRepository.findById(s.getTargetPmsGoalId())
                    .map(PmsGoalLine::getGoalName).orElse(null);
        }

        List<SessionParticipant> pList = participantRepository.findAllBySessionIdOrderByRoleAsc(s.getId());
        Set<Long> pEmpIds = pList.stream().map(SessionParticipant::getEmployeeId).collect(Collectors.toSet());
        Map<Long, Employee> pEmpMap = employeeRepository.findAllById(pEmpIds).stream()
                .collect(Collectors.toMap(Employee::getId, e -> e));

        List<SessionParticipantDto> partDtos = pList.stream().map(p -> {
            Employee emp = pEmpMap.get(p.getEmployeeId());
            String empNo = emp != null ? emp.getEmployeeNumber() : null;
            String fullName = emp != null ? emp.getFullName() : "Employee #" + p.getEmployeeId();
            String pos = emp != null ? (emp.getPosition() != null ? emp.getPosition() : emp.getJob()) : null;
            String dept = emp != null ? (emp.getDepartment() != null ? emp.getDepartment().getName() : emp.getDepartmentName()) : null;

            return new SessionParticipantDto(
                    p.getId(),
                    p.getSessionId(),
                    p.getEmployeeId(),
                    empNo,
                    fullName,
                    dept,
                    pos,
                    p.getRole(),
                    p.getInvitationStatus(),
                    p.getInvitationDeclineReason(),
                    p.getRespondedAt(),
                    p.getAttendanceStatus(),
                    p.getAttendanceMarkedAt(),
                    p.getCoachAssessment(),
                    p.getIndividualNotes(),
                    p.getFeedbackRating(),
                    p.getFeedbackComment(),
                    p.getFeedbackSubmittedAt(),
                    p.getCoacheeProgressNotes(),
                    p.getCoacheeProgressSubmittedAt()
            );
        }).toList();

        RescheduleProposalDto pendingProposalDto = null;
        if (s.getStatus() == SessionStatus.RESCHEDULE_PENDING) {
            Optional<SessionScheduleProposal> pendingOpt = proposalRepository
                    .findFirstBySessionIdAndStatusOrderByCreatedAtDesc(s.getId(), ProposalStatus.PENDING);
            if (pendingOpt.isPresent()) {
                SessionScheduleProposal p = pendingOpt.get();
                String proposerName = employeeRepository.findById(p.getProposedByEmployeeId())
                        .map(Employee::getFullName).orElse("Participant");
                pendingProposalDto = new RescheduleProposalDto(
                        p.getId(),
                        p.getSessionId(),
                        p.getProposedByEmployeeId(),
                        proposerName,
                        p.getProposedStartTime(),
                        p.getProposedEndTime(),
                        p.getReason(),
                        p.getStatus(),
                        p.getCreatedAt()
                );
            }
        }

        return new CoachingSessionDto(
                s.getId(),
                s.getAssignmentId(),
                s.getSkillRequestId(),
                s.getCoachEmployeeId(),
                coachEmpNo,
                coachName,
                coachJob,
                coachDept,
                s.getTitle(),
                s.getPathway(),
                s.getScheduledStartTime(),
                s.getScheduledEndTime(),
                s.getDurationMinutes(),
                s.getMeetingMode(),
                s.getMeetingLocation(),
                s.getDailyRoomName(),
                s.getDailyRoomUrl(),
                s.getStatus(),
                s.getCancellationReason(),
                s.getTargetPmsGoalId(),
                goalName,
                s.getSessionNotesMinutes(),
                s.getActionItems(),
                s.getConductedAt(),
                partDtos,
                pendingProposalDto,
                s.getCreatedAt(),
                s.getSeriesId(),
                s.getSequenceNumber(),
                s.isExtensionSession()
        );
    }

    private EmployeeDto getCallerEmployeeOrThrow(ApidUserPrincipal actor) {
        return employeeQueryService.findByUserId(actor.getUserId())
                .orElseThrow(() -> new AccessDeniedException("No employee profile linked to user account."));
    }

    private boolean isAdmin(ApidUserPrincipal actor) {
        return actor.getAuthorities().stream()
                .anyMatch(a -> a.getAuthority().equals("COACHING_ASSIGNMENT_VIEW_ALL") ||
                               a.getAuthority().equals("USER_MANAGE"));
    }
}
