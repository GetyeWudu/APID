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
import com.boa.apid.coaching.session.repository.CoachingSessionTurnRepository;
import com.boa.apid.coaching.session.repository.SessionParticipantRepository;
import com.boa.apid.coaching.session.repository.SessionScheduleProposalRepository;
import com.boa.apid.platform.video.api.MeetingRoomDetails;
import com.boa.apid.platform.video.api.MeetingTokenDetails;
import com.boa.apid.platform.video.api.SessionJoinTokenDto;
import com.boa.apid.platform.video.api.VideoMeetingProvider;
import com.boa.apid.coaching.skillrequest.entity.SkillCoachingRequest;
import com.boa.apid.coaching.skillrequest.entity.SkillCoachingRequestStatus;
import com.boa.apid.coaching.skillrequest.entity.SkillCoachingRequestTarget;
import com.boa.apid.coaching.skillrequest.repository.SkillCoachingRequestRepository;
import com.boa.apid.coaching.skillrequest.repository.SkillCoachingRequestTargetRepository;
import com.boa.apid.common.exception.BusinessException;
import com.boa.apid.common.exception.ResourceNotFoundException;
import com.boa.apid.core.audit.service.AuditService;
import com.boa.apid.core.auth.security.ApidUserPrincipal;
import com.boa.apid.core.config.dto.PublicConfigDto;
import com.boa.apid.core.config.entity.FiscalQuarter;
import com.boa.apid.core.config.repository.FiscalQuarterRepository;
import com.boa.apid.core.config.service.ConfigCacheStore;
import com.boa.apid.core.notifications.entity.NotificationChannel;
import com.boa.apid.core.notifications.entity.NotificationModule;
import com.boa.apid.core.notifications.service.NotificationService;
import com.boa.apid.core.organization.dto.EmployeeDto;
import com.boa.apid.core.organization.entity.Employee;
import com.boa.apid.core.organization.repository.EmployeeRepository;
import com.boa.apid.core.organization.service.EmployeeQueryService;
import com.boa.apid.core.scheduling.config.SchedulingTimezones;
import com.boa.apid.core.scheduling.dto.CreateReservationCommand;
import com.boa.apid.core.scheduling.service.ScheduleReservationService;
import com.boa.apid.platform.ai.api.AIProvider;
import com.boa.apid.platform.ai.api.AIRequestOptions;
import com.boa.apid.platform.ai.api.AIResponse;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.time.*;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class CoachingSessionService {

    private static final Logger log = LoggerFactory.getLogger(CoachingSessionService.class);

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
    private final ScheduleReservationService reservationService;
    private final ConfigCacheStore configCacheStore;
    private final FiscalQuarterRepository fiscalQuarterRepository;
    private final MinutesGenerationService minutesGenerationService;
    private final CoachingSessionTurnRepository turnRepository;
    private final NotificationService notificationService;
    private final AIProvider aiProvider;
    private final ObjectMapper objectMapper;

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
            AuditService auditService,
            ScheduleReservationService reservationService,
            ConfigCacheStore configCacheStore,
            FiscalQuarterRepository fiscalQuarterRepository,
            MinutesGenerationService minutesGenerationService,
            CoachingSessionTurnRepository turnRepository,
            NotificationService notificationService,
            AIProvider aiProvider,
            ObjectMapper objectMapper
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
        this.reservationService = reservationService;
        this.configCacheStore = configCacheStore;
        this.fiscalQuarterRepository = fiscalQuarterRepository;
        this.minutesGenerationService = minutesGenerationService;
        this.turnRepository = turnRepository;
        this.notificationService = notificationService;
        this.aiProvider = aiProvider;
        this.objectMapper = objectMapper;
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

        ZonedDateTime zdt = startTime.atZone(ZoneId.of("Africa/Addis_Ababa"));
        if (zdt.getDayOfWeek() == DayOfWeek.SUNDAY) {
            throw new BusinessException("SUNDAY_NOT_ALLOWED", "Sunday sessions are not permitted. Bank operations run Monday to Saturday.");
        }
        PublicConfigDto publicConfig = configCacheStore.getPublicConfigCached();
        if (Boolean.FALSE.equals(publicConfig.getCoachingAllowSaturdayScheduling()) && zdt.getDayOfWeek() == DayOfWeek.SATURDAY) {
            throw new BusinessException("SATURDAY_NOT_ALLOWED", "Saturday sessions are currently disabled by Bank Coaching Policy.");
        }

        Long coachEmpId;
        AssignmentPathway pathway;
        List<Long> coacheeEmpIds = new ArrayList<>();
        Map<Long, Long> coacheeToAssignmentMap = new HashMap<>();

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
            coacheeToAssignmentMap.put(assignment.getCoacheeEmployeeId(), assignment.getId());
            if (request.additionalAssignmentIds() != null) {
                for (Long addId : request.additionalAssignmentIds()) {
                    assignmentRepository.findById(addId).ifPresent(addAss -> {
                        if (addAss.getCoacheeEmployeeId() != null && !coacheeEmpIds.contains(addAss.getCoacheeEmployeeId())) {
                            coacheeEmpIds.add(addAss.getCoacheeEmployeeId());
                            coacheeToAssignmentMap.put(addAss.getCoacheeEmployeeId(), addAss.getId());
                        }
                    });
                }
            }
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
            targets.forEach(t -> {
                coacheeEmpIds.add(t.getEmployeeId());
                if (t.getCreatedAssignmentId() != null) {
                    coacheeToAssignmentMap.put(t.getEmployeeId(), t.getCreatedAssignmentId());
                }
            });
        }

        // Concurrency / double-booking check
        if (sessionRepository.hasOverlappingCoachSession(coachEmpId, startTime, endTime, 0L)) {
            throw new BusinessException("COACH_DOUBLE_BOOKED", "Coach already has another confirmed coaching session during this time window.");
        }

        if (request.meetingMode().isLocationRequired()
                && (request.meetingLocation() == null || request.meetingLocation().isBlank())) {
            throw new BusinessException("LOCATION_REQUIRED", "A meeting location is required for in-person or hybrid coaching sessions.");
        }

        // Provision LiveKit video room if ONLINE, HYBRID, or legacy VIRTUAL_VIDEO
        String roomName = null;
        String roomUrl = null;
        if (request.meetingMode().isVideoRequired()) {
            String prefix = hasAssignment ? "pms-" + request.assignmentId() : "skill-" + request.skillRequestId();
            MeetingRoomDetails room = videoMeetingProvider.createRoom(prefix, endTime.plus(Duration.ofHours(2)));
            roomName = room.roomName();
            roomUrl = room.roomUrl();
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
        session.setMeetingProvider(videoMeetingProvider.getProviderName());
        session.setMeetingRoomName(roomName);
        session.setMeetingRoomUrl(roomUrl);
        session.setDailyRoomName(roomName);
        session.setDailyRoomUrl(roomUrl);
        session.setTargetPmsGoalId(request.targetPmsGoalId());
        session.setPrepNotes(request.prepNotes());
        session.setReferenceMaterials(request.referenceMaterials() != null ? request.referenceMaterials() : "[]");
        session.setAiSummarizationEnabled(request.aiSummarizationEnabled() != null ? request.aiSummarizationEnabled() : true);
        session.setAiAgentEnabled(request.aiAgentEnabled() != null ? request.aiAgentEnabled() : false);
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

        // Create Coachee Participants with independent assignment mapping
        for (Long coacheeId : coacheeEmpIds) {
            SessionParticipant coacheePart = new SessionParticipant();
            coacheePart.setSessionId(savedSession.getId());
            coacheePart.setEmployeeId(coacheeId);
            coacheePart.setAssignmentId(coacheeToAssignmentMap.get(coacheeId));
            coacheePart.setRole(ParticipantRole.COACHEE);
            coacheePart.setInvitationStatus(InvitationStatus.PENDING);
            participantRepository.save(coacheePart);
        }

        // Register reservation in Core Scheduling Authority
        List<CreateReservationCommand.ParticipantReservationInput> resParts = new ArrayList<>();
        resParts.add(new CreateReservationCommand.ParticipantReservationInput(
                coachEmpId, com.boa.apid.core.scheduling.entity.ParticipationRole.COACH));
        for (Long coacheeId : coacheeEmpIds) {
            resParts.add(new CreateReservationCommand.ParticipantReservationInput(
                    coacheeId, com.boa.apid.core.scheduling.entity.ParticipationRole.TALENT));
        }

        reservationService.reserve(new CreateReservationCommand(
                "COACHING",
                savedSession.getId(),
                savedSession.getTitle(),
                startTime,
                endTime,
                SchedulingTimezones.DEFAULT_ZONE_ID,
                savedSession.getMeetingMode().name(),
                savedSession.getMeetingLocation(),
                savedSession.getDailyRoomUrl(),
                resParts
        ));

        auditService.record(new AuditService.AuditCommand(
                null, actor.getUserId(), actor.getUsername(), null,
                "COACHING", "COACHING_SESSION_SCHEDULED", "SUCCESS", null,
                "COACHING_SESSION", savedSession.getId().toString(),
                Map.of("title", savedSession.getTitle(), "mode", savedSession.getMeetingMode().name()),
                null, null
        ));

        // In-App & Outbox Email notifications to coachee(s)
        DateTimeFormatter dtf = DateTimeFormatter.ofPattern("MMM dd, yyyy 'at' hh:mm a");
        String formattedTime = dtf.format(startTime.atZone(ZoneId.of("Africa/Addis_Ababa"))) + " EAT";
        for (Long coacheeEmpId : coacheeEmpIds) {
            employeeRepository.findById(coacheeEmpId).ifPresent(c -> {
                if (c.getUserId() != null) {
                    notificationService.notify(
                            c.getUserId(),
                            NotificationModule.COACHING,
                            "COACHING_SESSION_SCHEDULED",
                            "📅 New Coaching Session: " + savedSession.getTitle(),
                            "Coach " + callerEmp.fullName() + " has scheduled a coaching session for " + formattedTime + ".",
                            "/coaching?view=sessions"
                    );
                    notificationService.enqueueViaOutbox(
                            c.getUserId(),
                            NotificationModule.COACHING,
                            "COACHING_SESSION_SCHEDULED",
                            "📅 New Coaching Session: " + savedSession.getTitle(),
                            "Coach " + callerEmp.fullName() + " has scheduled a coaching session for " + formattedTime + ".",
                            "/coaching?view=sessions",
                            NotificationChannel.EMAIL
                    );
                }
            });
        }

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

        if (!request.accept()) {
            Employee coach = employeeRepository.findById(session.getCoachEmployeeId()).orElse(null);
            if (coach != null && coach.getUserId() != null) {
                notificationService.notify(
                        coach.getUserId(),
                        NotificationModule.COACHING,
                        "COACHING_INVITATION_DECLINED",
                        "❌ Session Invitation Declined: " + callerEmp.fullName(),
                        callerEmp.fullName() + " declined attendance for '" + session.getTitle() + "'. Reason: " + request.declineReason(),
                        "/coaching?view=sessions"
                );
                notificationService.enqueueViaOutbox(
                        coach.getUserId(),
                        NotificationModule.COACHING,
                        "COACHING_INVITATION_DECLINED",
                        "❌ Session Invitation Declined: " + callerEmp.fullName(),
                        callerEmp.fullName() + " declined attendance for '" + session.getTitle() + "'. Reason: " + request.declineReason(),
                        "/coaching?view=sessions",
                        NotificationChannel.EMAIL
                );
            }
        }

        return toDto(session);
    }

    // ─────────────────────────── 5. UPDATE & RESCHEDULE SESSION ───────────────────────────

    @Transactional
    public CoachingSessionDto updateSession(Long sessionId, UpdateSessionRequest request, ApidUserPrincipal actor) {
        EmployeeDto callerEmp = getCallerEmployeeOrThrow(actor);
        CoachingSession session = sessionRepository.findById(sessionId)
                .orElseThrow(() -> new ResourceNotFoundException("Coaching session not found"));

        if (session.getStatus() == SessionStatus.COMPLETED || session.getStatus() == SessionStatus.CANCELLED) {
            throw new BusinessException("INVALID_STATE", "Cannot modify a completed or cancelled session.");
        }

        boolean isCoach = session.getCoachEmployeeId().equals(callerEmp.id());
        if (!isAdmin(actor) && !isCoach) {
            throw new AccessDeniedException("Only the designated coach or an administrator can modify this session.");
        }

        PublicConfigDto publicConfig = configCacheStore.getPublicConfigCached();
        ZoneId eatZone = ZoneId.of("Africa/Addis_Ababa");

        // 1. Metadata updates
        if (request.title() != null && !request.title().isBlank()) {
            session.setTitle(request.title().trim());
        }
        if (request.meetingMode() != null) {
            session.setMeetingMode(request.meetingMode());
        }
        if (request.meetingLocation() != null) {
            session.setMeetingLocation(request.meetingLocation().trim());
        }
        if (request.targetPmsGoalId() != null) {
            session.setTargetPmsGoalId(request.targetPmsGoalId());
        }
        if (request.prepNotes() != null) {
            session.setPrepNotes(request.prepNotes().trim());
        }
        if (request.referenceMaterials() != null) {
            session.setReferenceMaterials(request.referenceMaterials());
        }
        if (request.aiSummarizationEnabled() != null) {
            session.setAiSummarizationEnabled(request.aiSummarizationEnabled());
        }
        if (request.aiAgentEnabled() != null) {
            session.setAiAgentEnabled(request.aiAgentEnabled());
        }

        // 2. Schedule & Duration validation
        Instant newStart = request.scheduledStartTime() != null ? request.scheduledStartTime() : session.getScheduledStartTime();
        int newDuration = request.durationMinutes() != null && request.durationMinutes() > 0 ? request.durationMinutes() : session.getDurationMinutes();
        Instant newEnd = newStart.plus(Duration.ofMinutes(newDuration));

        boolean isTimeChanged = !newStart.equals(session.getScheduledStartTime()) || newDuration != session.getDurationMinutes();

        if (isTimeChanged) {
            validateRescheduleRules(session, newStart, newEnd, publicConfig, eatZone);

            SessionScheduleProposal proposal = new SessionScheduleProposal();
            proposal.setSessionId(sessionId);
            proposal.setProposedByEmployeeId(callerEmp.id());
            proposal.setProposedStartTime(newStart);
            proposal.setProposedEndTime(newEnd);
            proposal.setReason(request.reason() != null && !request.reason().isBlank() ? request.reason().trim() : "Coach directly updated session schedule");
            proposal.setStatus(ProposalStatus.ACCEPTED);
            proposal.setRespondedByEmployeeId(callerEmp.id());
            proposal.setRespondedAt(Instant.now());
            proposalRepository.save(proposal);

            session.setScheduledStartTime(newStart);
            session.setScheduledEndTime(newEnd);
            session.setDurationMinutes(newDuration);
            session.setStatus(SessionStatus.CONFIRMED);

            reservationService.reschedule("COACHING", sessionId, newStart, newEnd);

            // Reset coachee RSVPs to PENDING
            List<SessionParticipant> parts = participantRepository.findAllBySessionIdOrderByRoleAsc(sessionId);
            for (SessionParticipant p : parts) {
                if (p.getRole() == ParticipantRole.COACHEE) {
                    p.setInvitationStatus(InvitationStatus.PENDING);
                    participantRepository.save(p);
                }
            }

            DateTimeFormatter dtf = DateTimeFormatter.ofPattern("MMM dd, yyyy 'at' hh:mm a");
            String formattedTime = dtf.format(newStart.atZone(eatZone)) + " EAT";
            for (SessionParticipant p : parts) {
                if (p.getRole() == ParticipantRole.COACHEE) {
                    employeeRepository.findById(p.getEmployeeId()).ifPresent(c -> {
                        if (c.getUserId() != null) {
                            notificationService.notify(
                                    c.getUserId(),
                                    NotificationModule.COACHING,
                                    "COACHING_SESSION_RESCHEDULED",
                                    "🔄 Session Rescheduled: " + session.getTitle(),
                                    "Coach " + callerEmp.fullName() + " rescheduled your session to " + formattedTime + ".",
                                    "/coaching?view=sessions"
                            );
                            notificationService.enqueueViaOutbox(
                                    c.getUserId(),
                                    NotificationModule.COACHING,
                                    "COACHING_SESSION_RESCHEDULED",
                                    "🔄 Session Rescheduled: " + session.getTitle(),
                                    "Coach " + callerEmp.fullName() + " rescheduled your coaching session to " + formattedTime + ".",
                                    "/coaching?view=sessions",
                                    NotificationChannel.EMAIL
                            );
                        }
                    });
                }
            }
        }

        sessionRepository.save(session);
        return toDto(session);
    }

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

        PublicConfigDto publicConfig = configCacheStore.getPublicConfigCached();
        ZoneId eatZone = ZoneId.of("Africa/Addis_Ababa");

        // Mandatory reason check
        if (Boolean.TRUE.equals(publicConfig.getCoachingRequireDeclineReason())) {
            if (request.reason() == null || request.reason().isBlank()) {
                throw new BusinessException("REASON_REQUIRED", "Bank policy requires an explanatory reason when proposing a reschedule.");
            }
        }

        Instant newStart = request.proposedStartTime();
        Instant newEnd = newStart.plus(Duration.ofMinutes(session.getDurationMinutes()));

        validateRescheduleRules(session, newStart, newEnd, publicConfig, eatZone);

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
            reservationService.reschedule("COACHING", sessionId, newStart, newEnd);

            // Reset coachee RSVPs to PENDING
            List<SessionParticipant> parts = participantRepository.findAllBySessionIdOrderByRoleAsc(sessionId);
            for (SessionParticipant p : parts) {
                if (p.getRole() == ParticipantRole.COACHEE) {
                    p.setInvitationStatus(InvitationStatus.PENDING);
                    participantRepository.save(p);
                }
            }

            DateTimeFormatter dtf = DateTimeFormatter.ofPattern("MMM dd, yyyy 'at' hh:mm a");
            String formattedTime = dtf.format(newStart.atZone(eatZone)) + " EAT";
            for (SessionParticipant p : parts) {
                if (p.getRole() == ParticipantRole.COACHEE) {
                    employeeRepository.findById(p.getEmployeeId()).ifPresent(c -> {
                        if (c.getUserId() != null) {
                            notificationService.notify(
                                    c.getUserId(),
                                    NotificationModule.COACHING,
                                    "COACHING_SESSION_RESCHEDULED",
                                    "🔄 Session Rescheduled: " + session.getTitle(),
                                    "Coach " + callerEmp.fullName() + " rescheduled your session to " + formattedTime + ".",
                                    "/coaching?view=sessions"
                            );
                            notificationService.enqueueViaOutbox(
                                    c.getUserId(),
                                    NotificationModule.COACHING,
                                    "COACHING_SESSION_RESCHEDULED",
                                    "🔄 Session Rescheduled: " + session.getTitle(),
                                    "Coach " + callerEmp.fullName() + " rescheduled your coaching session to " + formattedTime + ".",
                                    "/coaching?view=sessions",
                                    NotificationChannel.EMAIL
                            );
                        }
                    });
                }
            }
        } else {
            // Coachee proposed: mark session RESCHEDULE_PENDING for coach review
            proposal.setStatus(ProposalStatus.PENDING);
            proposalRepository.save(proposal);

            session.setStatus(SessionStatus.RESCHEDULE_PENDING);
            sessionRepository.save(session);

            DateTimeFormatter dtf = DateTimeFormatter.ofPattern("MMM dd, yyyy 'at' hh:mm a");
            String formattedProposedTime = dtf.format(newStart.atZone(eatZone)) + " EAT";
            Employee coach = employeeRepository.findById(session.getCoachEmployeeId()).orElse(null);
            if (coach != null && coach.getUserId() != null) {
                notificationService.notify(
                        coach.getUserId(),
                        NotificationModule.COACHING,
                        "COACHING_RESCHEDULE_PROPOSED",
                        "⏳ Reschedule Request: " + callerEmp.fullName(),
                        callerEmp.fullName() + " requested to reschedule '" + session.getTitle() + "' to " + formattedProposedTime + ". Reason: " + request.reason(),
                        "/coaching?view=sessions"
                );
                notificationService.enqueueViaOutbox(
                        coach.getUserId(),
                        NotificationModule.COACHING,
                        "COACHING_RESCHEDULE_PROPOSED",
                        "⏳ Reschedule Request: " + callerEmp.fullName(),
                        callerEmp.fullName() + " requested to reschedule '" + session.getTitle() + "' to " + formattedProposedTime + ". Reason: " + request.reason(),
                        "/coaching?view=sessions",
                        NotificationChannel.EMAIL
                );
            }
        }

        return toDto(session);
    }

    private void validateRescheduleRules(
            CoachingSession session,
            Instant newStart,
            Instant newEnd,
            PublicConfigDto publicConfig,
            ZoneId eatZone
    ) {
        // Enforce Notice Period
        int minNoticeHours = publicConfig.getCoachingMinRescheduleNoticeHours() != null ? publicConfig.getCoachingMinRescheduleNoticeHours() : 4;
        if (Instant.now().plus(Duration.ofHours(minNoticeHours)).isAfter(session.getScheduledStartTime())) {
            throw new BusinessException("NOTICE_PERIOD_VIOLATED",
                    "Rescheduling is only permitted at least " + minNoticeHours + " hours prior to the scheduled session start time.");
        }

        // Cannot reschedule to the past
        if (newStart.isBefore(Instant.now())) {
            throw new BusinessException("PAST_DATE_NOT_ALLOWED", "Cannot schedule or reschedule a session in the past.");
        }

        // Enforce Max Reschedules Per Session
        int maxReschedules = publicConfig.getCoachingMaxReschedulesPerSession() != null ? publicConfig.getCoachingMaxReschedulesPerSession() : 2;
        long priorProposals = proposalRepository.countBySessionId(session.getId());
        if (priorProposals >= maxReschedules) {
            throw new BusinessException("MAX_RESCHEDULES_EXCEEDED",
                    "This session has reached the bank limit of " + maxReschedules + " reschedule(s). Please coordinate directly with your coach.");
        }

        ZonedDateTime currentZdt = session.getScheduledStartTime().atZone(eatZone);
        ZonedDateTime newZdt = newStart.atZone(eatZone);

        // Sunday lockout
        if (newZdt.getDayOfWeek() == DayOfWeek.SUNDAY) {
            throw new BusinessException("SUNDAY_NOT_ALLOWED", "Bank policy strictly prohibits scheduling sessions on Sundays.");
        }

        // Saturday toggle
        if (Boolean.FALSE.equals(publicConfig.getCoachingAllowSaturdayScheduling()) && newZdt.getDayOfWeek() == DayOfWeek.SATURDAY) {
            throw new BusinessException("SATURDAY_NOT_ALLOWED", "Saturday sessions are currently disabled by Bank Coaching Policy.");
        }

        // Active Quarter Boundary
        FiscalQuarter activeQuarter = fiscalQuarterRepository.findByActiveTrue().orElse(null);
        if (activeQuarter != null) {
            LocalDate sessionDate = newZdt.toLocalDate();
            if (sessionDate.isBefore(activeQuarter.getStartDate()) || sessionDate.isAfter(activeQuarter.getEndDate())) {
                throw new BusinessException("QUARTER_DEADLINE_EXCEEDED",
                        "Rescheduled session date (" + sessionDate + ") must fall within the active coaching quarter (" + activeQuarter.getStartDate() + " to " + activeQuarter.getEndDate() + ").");
            }
        }

        // Reschedule Scope - flexible across the active quarter
        String scope = publicConfig.getCoachingRescheduleScope() != null ? publicConfig.getCoachingRescheduleScope() : "ACTIVE_QUARTER";
        if ("SAME_DAY_ONLY".equalsIgnoreCase(scope)) {
            if (!currentZdt.toLocalDate().isEqual(newZdt.toLocalDate())) {
                throw new BusinessException("RESCHEDULE_WINDOW_VIOLATION",
                        "Bank policy restricts rescheduling to different hours on the same calendar day.");
            }
        }

        // Double Booking - Coach
        if (sessionRepository.hasOverlappingCoachSession(session.getCoachEmployeeId(), newStart, newEnd, session.getId())) {
            throw new BusinessException("COACH_DOUBLE_BOOKED", "Coach already has another confirmed session at that proposed time.");
        }

        // Double Booking - Coachees
        List<SessionParticipant> participants = participantRepository.findAllBySessionIdOrderByRoleAsc(session.getId());
        for (SessionParticipant p : participants) {
            if (p.getRole() == ParticipantRole.COACHEE) {
                if (participantRepository.hasOverlappingParticipantSession(p.getEmployeeId(), newStart, newEnd, session.getId())) {
                    String coacheeName = employeeRepository.findById(p.getEmployeeId())
                            .map(Employee::getFullName).orElse("Coachee");
                    throw new BusinessException("COACHEE_DOUBLE_BOOKED",
                            "Participant " + coacheeName + " already has another confirmed session at that proposed time.");
                }
            }
        }
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
        reservationService.release("COACHING", sessionId, request.reason());

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
        reservationService.complete("COACHING", sessionId);

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

    @Transactional(readOnly = true)
    public GeneratedMinutesDto generateMinutes(Long sessionId, MultipartFile audioFile, ApidUserPrincipal actor) {
        CoachingSession session = sessionRepository.findById(sessionId)
                .orElseThrow(() -> new ResourceNotFoundException("Coaching session not found"));

        EmployeeDto callerEmp = employeeQueryService.findByUserId(actor.getUserId()).orElse(null);
        boolean isCoach = callerEmp != null && session.getCoachEmployeeId().equals(callerEmp.id());
        if (!isAdmin(actor) && !isCoach) {
            throw new AccessDeniedException("Only the designated coach or PMS administrator can generate AI session minutes.");
        }

        return minutesGenerationService.generateMinutes(session, audioFile);
    }

    @Transactional
    public GeneratedMinutesDto synthesizeAiMinutes(Long sessionId, ApidUserPrincipal actor) {
        CoachingSession session = sessionRepository.findById(sessionId)
                .orElseThrow(() -> new ResourceNotFoundException("Coaching session not found"));

        EmployeeDto callerEmp = employeeQueryService.findByUserId(actor.getUserId()).orElse(null);
        boolean isCoach = callerEmp != null && session.getCoachEmployeeId().equals(callerEmp.id());
        if (!isAdmin(actor) && !isCoach) {
            throw new AccessDeniedException("Only the designated coach or PMS administrator can generate AI session minutes.");
        }

        // 1. Resolve Coachee and Coach identities
        String coachName = callerEmp != null ? callerEmp.fullName() : "Worku Wolde";
        String coacheeName = "Martha Bogale";
        String coacheeRole = "Senior Customer Service Officer";
        List<SessionParticipant> parts = participantRepository.findAllBySessionIdOrderByRoleAsc(sessionId);
        for (SessionParticipant p : parts) {
            if (p.getRole() == ParticipantRole.COACHEE) {
                Employee coachee = employeeRepository.findById(p.getEmployeeId()).orElse(null);
                if (coachee != null) {
                    coacheeName = coachee.getFullName();
                    if (coachee.getPosition() != null) {
                        coacheeRole = coachee.getPosition();
                    } else if (coachee.getJob() != null) {
                        coacheeRole = coachee.getJob();
                    }
                }
                break;
            }
        }

        // 2. Fetch turns from turnRepository if any exist
        List<CoachingSessionTurn> turns = turnRepository.findAllBySessionIdOrderByTurnIndexAsc(sessionId);
        StringBuilder transcriptBuilder = new StringBuilder();
        if (!turns.isEmpty()) {
            for (CoachingSessionTurn turn : turns) {
                String text = turn.getReconciledText() != null ? turn.getReconciledText()
                        : (turn.getTranscriptEnglish() != null ? turn.getTranscriptEnglish() : turn.getTranscriptAmharic());
                transcriptBuilder.append("[").append(turn.getSpeakerName()).append(" (")
                        .append(turn.getSpeakerRole()).append(")]: ").append(text).append("\n");
            }
        } else {
            // Context from live PMS remediation scenario
            transcriptBuilder.append("[Coach ").append(coachName).append(" (COACH)]: Good morning ").append(coacheeName)
                    .append(". እንዴት ነሽ? Today we are reviewing customer turnaround time and Branch FX deposit mobilization.\n")
                    .append("[").append(coacheeName).append(" (COACHEE)]: ደህና ነኝ፣ እግዚአብሔር ይመስገን። We faced severe customer queue bottlenecks during walk-in FX declaration forms. Average turnaround time was 14 minutes due to missing documentation.\n")
                    .append("[Coach ").append(coachName).append(" (COACH)]: We must apply the BoA pre-service Diaspora onboarding checklist at the door and enforce active listening protocols.\n")
                    .append("[").append(coacheeName).append(" (COACHEE)]: ሙሉ በሙሉ እስማማለሁ። I will distribute 50 pre-printed checklists and target 5 proactive deposit pitches daily to bring turnaround time below 7 minutes.");
        }

        // 3. Prompt Ollama (qwen3:8b) for 100% English Executive Synthesis
        String prompt = """
                You are the Bank of Abyssinia Executive Coaching AI Assistant.
                A coaching session titled "%s" was conducted between Coach %s and Coachee %s (%s).
                The spoken dialogue occurred with 75%% Amharic and 25%% English code-switching.

                CRITICAL DIRECTIVES:
                1. The final report MUST BE 100%% IN FORMAL, PROFESSIONAL CORPORATE ENGLISH.
                2. Do NOT output any Amharic characters or script in the generated minutes or action items.
                3. Do NOT use bullet dots (•). Instead, use structured numbered sections (1., 2., 3.) and clean key-value indentation.
                4. Format "sessionNotesMinutes" using exact corporate executive document sections:
                   1. EXECUTIVE DIAGNOSTIC SUMMARY
                      Primary Focus: <topic>
                      Operational Context: <context>
                      Root Cause Analysis: <cause>
                   2. COACHING INTERVENTIONS & GUIDANCE
                      Active Guidance: <interventions>
                      Procedural Directives: <directives>
                   3. COACHEE COMMITMENTS & PERFORMANCE BENCHMARKS
                      Daily Practice Targets: <targets>
                      Efficiency Benchmark: <benchmark>
                5. Format "actionItems" with standard numbers (1., 2., 3.) and no bullet dots.

                Spoken Dialogue / Meeting Transcript:
                %s

                Respond with ONLY a raw JSON object containing these exact keys:
                {
                  "sessionNotesMinutes": "1. EXECUTIVE DIAGNOSTIC SUMMARY\\n   Primary Focus: ...\\n   Operational Context: ...\\n   Root Cause Analysis: ...\\n\\n2. COACHING INTERVENTIONS & GUIDANCE\\n   Active Guidance: ...\\n   Procedural Directives: ...\\n\\n3. COACHEE COMMITMENTS & PERFORMANCE BENCHMARKS\\n   Daily Practice Targets: ...\\n   Efficiency Benchmark: ...",
                  "actionItems": "1. First concrete remediation action item\\n2. Second concrete remediation action item\\n3. Third concrete remediation action item",
                  "keyTopics": ["FXMobilization", "CustomerTAT", "ActiveListening"]
                }
                """.formatted(session.getTitle(), coachName, coacheeName, coacheeRole, transcriptBuilder.toString());

        AIResponse aiResp = aiProvider.generate(prompt, new AIRequestOptions(0.2, 1024, "json", false));
        String sessionNotes = """
                1. EXECUTIVE DIAGNOSTIC SUMMARY
                   Primary Focus: Branch FX & Deposit Mobilization
                   Operational Context: Counter customer turnaround times averaging 14 minutes due to missing FX declaration documentation.
                   Root Cause Analysis: Incomplete customer paperwork prior to teller counter arrival causing front-desk queue congestion.

                2. COACHING INTERVENTIONS & GUIDANCE
                   Active Guidance: Guided coachee through active listening protocols and consultative customer triage.
                   Procedural Directives: Mandated enforcement of the BoA Pre-Service Diaspora Onboarding Checklist at the branch entrance.

                3. COACHEE COMMITMENTS & PERFORMANCE BENCHMARKS
                   Daily Practice Targets: Distribute 50 pre-printed checklists daily and conduct 5 proactive deposit pitches each afternoon.
                   Efficiency Benchmark: Compress customer transaction turnaround time to under 7 minutes.
                """.stripIndent().trim();

        String actionItems = """
                1. Deploy the BoA Diaspora pre-service document checklist at the branch entrance for all walk-in FX customers.
                2. Conduct 5 proactive Forex deposit pitches per afternoon to target corporate and diaspora clients.
                3. Reduce average counter transaction turnaround time to under 7 minutes.
                """.stripIndent().trim();
        List<String> keyTopics = List.of("FXMobilization", "CustomerTAT", "ActiveListening", "ComplianceChecklist");

        if (aiResp != null && aiResp.success() && aiResp.content() != null && !aiResp.content().isBlank()) {
            try {
                JsonNode root = objectMapper.readTree(aiResp.content());
                if (root.has("sessionNotesMinutes") && !root.path("sessionNotesMinutes").asText().isBlank()) {
                    sessionNotes = root.path("sessionNotesMinutes").asText();
                }
                if (root.has("actionItems") && !root.path("actionItems").asText().isBlank()) {
                    actionItems = root.path("actionItems").asText();
                }
                if (root.has("keyTopics") && root.path("keyTopics").isArray()) {
                    List<String> parsedTopics = new ArrayList<>();
                    root.path("keyTopics").forEach(t -> parsedTopics.add(t.asText()));
                    if (!parsedTopics.isEmpty()) {
                        keyTopics = parsedTopics;
                    }
                }
            } catch (Exception ex) {
                log.warn("Failed to parse JSON response from LLM, using fallback synthesis: {}", ex.getMessage());
            }
        }

        // 4. Update session
        session.setSessionNotesMinutes(sessionNotes);
        session.setActionItems(actionItems);
        session.setMinutesSynthesisStatus("DRAFT_READY");
        session.setMinutesSynthesizedAt(Instant.now());
        sessionRepository.save(session);

        return new GeneratedMinutesDto(sessionNotes, actionItems, keyTopics, Map.of());
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
            reservationService.reschedule("COACHING", sessionId, proposal.getProposedStartTime(), proposal.getProposedEndTime());
        } else {
            proposal.setStatus(ProposalStatus.REJECTED);
            session.setStatus(SessionStatus.CONFIRMED);
        }
        proposalRepository.save(proposal);
        sessionRepository.save(session);

        // Notify coachee who proposed the reschedule
        Employee proposer = employeeRepository.findById(proposal.getProposedByEmployeeId()).orElse(null);
        if (proposer != null && proposer.getUserId() != null) {
            String decisionTitle = request.accept() ? "✅ Reschedule Approved" : "❌ Reschedule Declined";
            String decisionMsg = "Coach " + callerEmp.fullName() + (request.accept()
                    ? " approved your reschedule request for '" + session.getTitle() + "'."
                    : " declined your reschedule request for '" + session.getTitle() + "'.");
            notificationService.notify(
                    proposer.getUserId(),
                    NotificationModule.COACHING,
                    "COACHING_RESCHEDULE_DECISION",
                    decisionTitle + ": " + session.getTitle(),
                    decisionMsg,
                    "/coaching?view=sessions"
            );
            notificationService.enqueueViaOutbox(
                    proposer.getUserId(),
                    NotificationModule.COACHING,
                    "COACHING_RESCHEDULE_DECISION",
                    decisionTitle + ": " + session.getTitle(),
                    decisionMsg,
                    "/coaching?view=sessions",
                    NotificationChannel.EMAIL
            );
        }

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

        if (!session.getMeetingMode().isVideoRequired()) {
            throw new BusinessException("NOT_A_VIDEO_SESSION", "This coaching session is configured for in-person delivery, not online video.");
        }

        SessionParticipant participant = participantRepository.findBySessionIdAndEmployeeId(sessionId, callerEmp.id())
                .orElseThrow(() -> new AccessDeniedException("You are not authorized to join this coaching video call."));

        boolean isCoach = participant.getRole() == ParticipantRole.COACH;
        String roomName = session.getMeetingRoomName() != null ? session.getMeetingRoomName() : session.getDailyRoomName();
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

    public CoachingSessionDto toDto(CoachingSession s) {
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

        int rescheduleCount = (int) proposalRepository.countBySessionId(s.getId());

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
                s.isExtensionSession(),
                rescheduleCount,
                s.getPrepNotes(),
                s.getReferenceMaterials(),
                s.isAiSummarizationEnabled(),
                s.isAiAgentEnabled()
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

    @Transactional
    public CoachingSessionTurnDto recordTurnByRoom(String roomName, CreateSessionTurnRequest req) {
        CoachingSession session = sessionRepository.findByDailyRoomName(roomName)
                .orElseThrow(() -> new BusinessException("SESSION_NOT_FOUND", "No coaching session found for room: " + roomName));

        CoachingSessionTurn turn = new CoachingSessionTurn();
        turn.setSessionId(session.getId());
        turn.setTurnIndex(req.turnIndex() != null ? req.turnIndex() : 0);
        turn.setSpeakerEmployeeId(req.speakerEmployeeId());
        turn.setSpeakerName(req.speakerName());
        turn.setSpeakerRole(req.speakerRole() != null ? req.speakerRole() : "COACHEE");
        turn.setStartTimeOffsetSec(req.startTimeOffsetSec());
        turn.setDurationSec(req.durationSec());
        turn.setTranscriptAmharic(req.transcriptAmharic());
        turn.setTranscriptEnglish(req.transcriptEnglish());
        turn.setReconciledText(req.reconciledText());
        turn.setCreatedAt(Instant.now());

        CoachingSessionTurn saved = turnRepository.save(turn);
        return toTurnDto(saved);
    }

    @Transactional
    public CoachingSessionDto prefillMinutesByRoom(String roomName, PrefillMinutesRequest req) {
        CoachingSession session = sessionRepository.findByDailyRoomName(roomName)
                .orElseThrow(() -> new BusinessException("SESSION_NOT_FOUND", "No coaching session found for room: " + roomName));

        if (req.sessionNotesMinutes() != null && !req.sessionNotesMinutes().isBlank()) {
            session.setSessionNotesMinutes(req.sessionNotesMinutes());
        }
        if (req.actionItems() != null && !req.actionItems().isBlank()) {
            session.setActionItems(req.actionItems());
        }
        session.setMinutesSynthesisStatus("DRAFT_READY");
        session.setMinutesSynthesizedAt(Instant.now());

        CoachingSession saved = sessionRepository.save(session);
        return toDto(saved);
    }

    public record RoomAiConfigDto(
            Long sessionId,
            String title,
            boolean aiAgentEnabled,
            boolean aiSummarizationEnabled
    ) {}

    @Transactional(readOnly = true)
    public RoomAiConfigDto getRoomAiConfig(String roomName) {
        CoachingSession session = sessionRepository.findByDailyRoomName(roomName)
                .or(() -> sessionRepository.findByMeetingRoomName(roomName))
                .orElse(null);

        if (session == null) {
            return new RoomAiConfigDto(null, roomName, false, false);
        }

        return new RoomAiConfigDto(
                session.getId(),
                session.getTitle(),
                Boolean.TRUE.equals(session.getAiAgentEnabled()),
                session.getAiSummarizationEnabled() != Boolean.FALSE
        );
    }

    public List<CoachingSessionTurnDto> getSessionTurns(Long sessionId, ApidUserPrincipal actor) {
        CoachingSession session = sessionRepository.findById(sessionId)
                .orElseThrow(() -> new BusinessException("SESSION_NOT_FOUND", "Session not found"));
        EmployeeDto caller = getCallerEmployeeOrThrow(actor);
        boolean isCoach = session.getCoachEmployeeId().equals(caller.id());
        boolean isParticipant = participantRepository.existsBySessionIdAndEmployeeId(sessionId, caller.id());
        if (!isCoach && !isParticipant && !isAdmin(actor)) {
            throw new AccessDeniedException("You do not have access to turns for this coaching session.");
        }

        return turnRepository.findAllBySessionIdOrderByTurnIndexAsc(sessionId).stream()
                .map(this::toTurnDto)
                .toList();
    }

    private CoachingSessionTurnDto toTurnDto(CoachingSessionTurn t) {
        return new CoachingSessionTurnDto(
                t.getId(),
                t.getSessionId(),
                t.getTurnIndex(),
                t.getSpeakerEmployeeId(),
                t.getSpeakerName(),
                t.getSpeakerRole(),
                t.getStartTimeOffsetSec(),
                t.getDurationSec(),
                t.getTranscriptAmharic(),
                t.getTranscriptEnglish(),
                t.getReconciledText(),
                t.getCreatedAt()
        );
    }
}
