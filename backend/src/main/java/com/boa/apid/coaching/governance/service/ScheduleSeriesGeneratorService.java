package com.boa.apid.coaching.governance.service;

import com.boa.apid.coaching.assignment.entity.AssignmentPathway;
import com.boa.apid.coaching.assignment.entity.AssignmentStatus;
import com.boa.apid.coaching.assignment.entity.CoachingAssignment;
import com.boa.apid.coaching.assignment.repository.CoachingAssignmentRepository;
import com.boa.apid.coaching.governance.dto.*;
import com.boa.apid.coaching.governance.entity.CadenceType;
import com.boa.apid.coaching.governance.entity.CoachingScheduleSeries;
import com.boa.apid.coaching.governance.entity.SeriesStatus;
import com.boa.apid.coaching.governance.repository.CoachingScheduleSeriesRepository;
import com.boa.apid.coaching.session.dto.CoachingSessionDto;
import com.boa.apid.coaching.session.entity.*;
import com.boa.apid.coaching.session.repository.CoachingSessionRepository;
import com.boa.apid.coaching.session.repository.SessionParticipantRepository;
import com.boa.apid.coaching.session.service.CoachingSessionService;
import com.boa.apid.platform.video.api.MeetingRoomDetails;
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
import com.boa.apid.core.organization.dto.EmployeeDto;
import com.boa.apid.core.organization.service.EmployeeQueryService;
import com.boa.apid.core.scheduling.config.SchedulingTimezones;
import com.boa.apid.core.scheduling.dto.AvailabilityCheckRequest;
import com.boa.apid.core.scheduling.dto.AvailabilityCheckResponse;
import com.boa.apid.core.scheduling.dto.ConflictDescriptor;
import com.boa.apid.core.scheduling.dto.CreateReservationCommand;
import com.boa.apid.core.scheduling.service.ScheduleReservationService;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.*;
import java.util.*;

@Service
public class ScheduleSeriesGeneratorService {

    private final CoachingScheduleSeriesRepository seriesRepository;
    private final CoachingSessionRepository sessionRepository;
    private final SessionParticipantRepository participantRepository;
    private final CoachingAssignmentRepository assignmentRepository;
    private final SkillCoachingRequestRepository skillRequestRepository;
    private final SkillCoachingRequestTargetRepository skillRequestTargetRepository;
    private final EmployeeQueryService employeeQueryService;
    private final VideoMeetingProvider videoMeetingProvider;
    private final AuditService auditService;
    private final ScheduleReservationService reservationService;
    private final ConfigCacheStore configCacheStore;
    private final CoachingSessionService sessionService;
    private final FiscalQuarterRepository fiscalQuarterRepository;

    public ScheduleSeriesGeneratorService(
            CoachingScheduleSeriesRepository seriesRepository,
            CoachingSessionRepository sessionRepository,
            SessionParticipantRepository participantRepository,
            CoachingAssignmentRepository assignmentRepository,
            SkillCoachingRequestRepository skillRequestRepository,
            SkillCoachingRequestTargetRepository skillRequestTargetRepository,
            EmployeeQueryService employeeQueryService,
            VideoMeetingProvider videoMeetingProvider,
            AuditService auditService,
            ScheduleReservationService reservationService,
            ConfigCacheStore configCacheStore,
            CoachingSessionService sessionService,
            FiscalQuarterRepository fiscalQuarterRepository
    ) {
        this.seriesRepository = seriesRepository;
        this.sessionRepository = sessionRepository;
        this.participantRepository = participantRepository;
        this.assignmentRepository = assignmentRepository;
        this.skillRequestRepository = skillRequestRepository;
        this.skillRequestTargetRepository = skillRequestTargetRepository;
        this.employeeQueryService = employeeQueryService;
        this.videoMeetingProvider = videoMeetingProvider;
        this.auditService = auditService;
        this.reservationService = reservationService;
        this.configCacheStore = configCacheStore;
        this.sessionService = sessionService;
        this.fiscalQuarterRepository = fiscalQuarterRepository;
    }

    public SeriesPreviewResponse previewSeries(SeriesPreviewRequest request) {
        LocalDate startDate = request.firstSessionDate();
        LocalDate maxDate = request.quarterEndDate() != null 
                ? request.quarterEndDate() 
                : startDate.plusWeeks(12);

        List<DayOfWeek> days = parseDaysOfWeek(request.daysOfWeek());
        List<GeneratedDatePreviewDto> generated = new ArrayList<>();

        // Validate policy governance
        PublicConfigDto publicConfig = configCacheStore.getPublicConfigCached();
        if (Boolean.FALSE.equals(publicConfig.getCoachingAllowSaturdayScheduling()) && days.contains(DayOfWeek.SATURDAY)) {
            throw new BusinessException("SATURDAY_NOT_ALLOWED", "Saturday sessions are currently disabled by Bank Coaching Policy.");
        }
        if (Boolean.FALSE.equals(publicConfig.getCoachingAllowJointPmsGroup()) && request.additionalAssignmentIds() != null && !request.additionalAssignmentIds().isEmpty()) {
            throw new BusinessException("JOINT_PMS_NOT_ALLOWED", "Joint PMS group remediation is currently disabled by Bank Coaching Policy.");
        }
        if (request.additionalAssignmentIds() != null && publicConfig.getCoachingMaxJointGroupSize() != null) {
            int totalSelected = 1 + request.additionalAssignmentIds().size();
            if (totalSelected > publicConfig.getCoachingMaxJointGroupSize()) {
                throw new BusinessException("MAX_GROUP_SIZE_EXCEEDED", "Joint PMS groups cannot exceed " + publicConfig.getCoachingMaxJointGroupSize() + " talents per Bank Policy.");
            }
        }

        // Resolve participating employees for conflict checking
        List<Long> participantEmpIds = new ArrayList<>();
        if (request.assignmentId() != null) {
            assignmentRepository.findById(request.assignmentId()).ifPresent(a -> {
                if (a.getCoachEmployeeId() != null) participantEmpIds.add(a.getCoachEmployeeId());
                if (a.getCoacheeEmployeeId() != null) participantEmpIds.add(a.getCoacheeEmployeeId());
            });
            if (request.additionalAssignmentIds() != null) {
                for (Long addId : request.additionalAssignmentIds()) {
                    assignmentRepository.findById(addId).ifPresent(a -> {
                        if (a.getCoacheeEmployeeId() != null && !participantEmpIds.contains(a.getCoacheeEmployeeId())) {
                            participantEmpIds.add(a.getCoacheeEmployeeId());
                        }
                    });
                }
            }
        } else if (request.skillRequestId() != null) {
            skillRequestRepository.findById(request.skillRequestId()).ifPresent(sr -> {
                if (sr.getProposedCoachEmployeeId() != null) participantEmpIds.add(sr.getProposedCoachEmployeeId());
                List<SkillCoachingRequestTarget> targets = skillRequestTargetRepository.findAllByRequestId(sr.getId());
                targets.forEach(t -> participantEmpIds.add(t.getEmployeeId()));
            });
        }

        int target = request.targetOccurrences();
        int sequence = 1;

        if (request.customSessions() != null && !request.customSessions().isEmpty()) {
            List<CustomSessionSlotDto> sortedSlots = request.customSessions().stream()
                    .sorted(Comparator.comparing(CustomSessionSlotDto::sessionDate).thenComparing(CustomSessionSlotDto::startTime))
                    .toList();

            LocalDate baseStart = request.firstSessionDate() != null ? request.firstSessionDate() : sortedSlots.get(0).sessionDate();
            LocalDate startMonday = baseStart.with(java.time.temporal.TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));

            FiscalQuarter activeQuarter = fiscalQuarterRepository.findByActiveTrue().orElse(null);
            LocalDate quarterEnd = (activeQuarter != null && activeQuarter.getEndDate() != null)
                    ? activeQuarter.getEndDate()
                    : (request.quarterEndDate() != null ? request.quarterEndDate() : baseStart.plusWeeks(12));

            // Validate Sunday, Saturday policy, and Quarter boundary
            for (CustomSessionSlotDto slot : sortedSlots) {
                if (slot.sessionDate().getDayOfWeek() == DayOfWeek.SUNDAY) {
                    throw new BusinessException("SUNDAY_NOT_ALLOWED", "Sunday sessions are not permitted. Bank operations run Monday to Saturday.");
                }
                if (Boolean.FALSE.equals(publicConfig.getCoachingAllowSaturdayScheduling()) && slot.sessionDate().getDayOfWeek() == DayOfWeek.SATURDAY) {
                    throw new BusinessException("SATURDAY_NOT_ALLOWED", "Saturday sessions are currently disabled by Bank Coaching Policy.");
                }
                if (activeQuarter != null) {
                    if (slot.sessionDate().isAfter(activeQuarter.getEndDate())) {
                        throw new BusinessException("QUARTER_DEADLINE_EXCEEDED",
                                "Session date " + slot.sessionDate() + " exceeds the active coaching quarter deadline (" + activeQuarter.getLabel() + " ends " + activeQuarter.getEndDate() + "). Sessions must be held within the active remediation quarter.");
                    }
                    if (slot.sessionDate().isBefore(activeQuarter.getStartDate())) {
                        throw new BusinessException("QUARTER_START_VIOLATION",
                                "Session date " + slot.sessionDate() + " is earlier than active coaching quarter start (" + activeQuarter.getStartDate() + ").");
                    }
                }
            }

            // Validate weekly pacing quota
            Map<Integer, Long> weeklyCounts = sortedSlots.stream()
                    .collect(java.util.stream.Collectors.groupingBy(
                            s -> (int) java.time.temporal.ChronoUnit.WEEKS.between(startMonday, s.sessionDate().with(java.time.temporal.TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY))) + 1,
                            java.util.stream.Collectors.counting()
                    ));
            if (publicConfig.getCoachingMaxSessionsPerWeek() != null) {
                for (var entry : weeklyCounts.entrySet()) {
                    if (entry.getValue() > publicConfig.getCoachingMaxSessionsPerWeek()) {
                        throw new BusinessException("WEEKLY_QUOTA_EXCEEDED",
                                "Week " + entry.getKey() + " has " + entry.getValue() + " sessions, exceeding the bank policy maximum of " + publicConfig.getCoachingMaxSessionsPerWeek() + " sessions per week.");
                    }
                }
            }

            for (CustomSessionSlotDto slot : sortedSlots) {
                LocalTime start = slot.startTime();
                LocalTime end = slot.endTime() != null ? slot.endTime() : start.plusMinutes(request.durationMinutes());

                LocalDate currentMonday = slot.sessionDate().with(java.time.temporal.TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
                int currentWeek = (int) java.time.temporal.ChronoUnit.WEEKS.between(startMonday, currentMonday) + 1;
                if (slot.sessionDate().isAfter(quarterEnd) || currentWeek > 12) {
                    throw new BusinessException("QUARTER_WINDOW_EXCEEDED",
                            "Session " + sequence + " on " + slot.sessionDate() + " falls outside the active quarter schedule limit (deadline " + quarterEnd + ").");
                }
                boolean isBuffer = (currentWeek == 6 || currentWeek == 12);
                String note = isBuffer ? "Quarter checkpoint / buffer window" : "Standard coaching session";

                Instant startInstant = SchedulingTimezones.toUtcInstant(slot.sessionDate(), start);
                Instant endInstant = SchedulingTimezones.toUtcInstant(slot.sessionDate(), end);

                boolean hasConflict = false;
                String conflictDetails = null;

                if (!participantEmpIds.isEmpty()) {
                    AvailabilityCheckResponse check = reservationService.checkAvailability(new AvailabilityCheckRequest(
                            participantEmpIds,
                            startInstant,
                            endInstant,
                            "COACHING",
                            null
                    ));
                    if (!check.available()) {
                        hasConflict = true;
                        ConflictDescriptor first = check.conflicts().get(0);
                        conflictDetails = String.format("Conflict for %s (%s as %s)",
                                first.employeeName(), first.conflictingModule(), first.conflictingRole());
                    }
                }

                generated.add(new GeneratedDatePreviewDto(
                        sequence,
                        slot.sessionDate(),
                        slot.sessionDate().getDayOfWeek().name(),
                        start,
                        end,
                        currentWeek,
                        isBuffer,
                        note,
                        hasConflict,
                        conflictDetails
                ));
                sequence++;
            }
        } else {
            if (request.cadenceType() == CadenceType.TWICE_WEEKLY && days.size() < 2) {
                days = List.of(DayOfWeek.TUESDAY, DayOfWeek.THURSDAY);
            } else if (request.cadenceType() == CadenceType.THRICE_WEEKLY && days.size() < 3) {
                days = List.of(DayOfWeek.MONDAY, DayOfWeek.WEDNESDAY, DayOfWeek.FRIDAY);
            } else if (request.cadenceType() == CadenceType.EVERY_SATURDAY) {
                days = List.of(DayOfWeek.SATURDAY);
            }

            LocalDate dateIter = startDate;
            while (!dateIter.isAfter(maxDate) && sequence <= target) {
                if (days.contains(dateIter.getDayOfWeek())) {
                    if (request.cadenceType() == CadenceType.BIWEEKLY) {
                        long weeksFromStart = java.time.temporal.ChronoUnit.WEEKS.between(startDate, dateIter);
                        if (weeksFromStart % 2 != 0) {
                            dateIter = dateIter.plusDays(1);
                            continue;
                        }
                    }

                    LocalTime start = request.preferredStartTime();
                    if (request.dayStartTimes() != null && request.dayStartTimes().containsKey(dateIter.getDayOfWeek().name())) {
                        start = request.dayStartTimes().get(dateIter.getDayOfWeek().name());
                    }
                    LocalTime end = start.plusMinutes(request.durationMinutes());

                    LocalDate startMonday = startDate.with(java.time.temporal.TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
                    LocalDate currentMonday = dateIter.with(java.time.temporal.TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
                    int currentWeek = (int) java.time.temporal.ChronoUnit.WEEKS.between(startMonday, currentMonday) + 1;
                    boolean isBuffer = (currentWeek == 6 || currentWeek == 12);
                    String note = isBuffer ? "Quarter checkpoint / buffer window" : "Standard coaching session";

                    Instant startInstant = SchedulingTimezones.toUtcInstant(dateIter, start);
                    Instant endInstant = SchedulingTimezones.toUtcInstant(dateIter, end);

                    boolean hasConflict = false;
                    String conflictDetails = null;

                    if (!participantEmpIds.isEmpty()) {
                        AvailabilityCheckResponse check = reservationService.checkAvailability(new AvailabilityCheckRequest(
                                participantEmpIds,
                                startInstant,
                                endInstant,
                                "COACHING",
                                null
                        ));
                        if (!check.available()) {
                            hasConflict = true;
                            ConflictDescriptor first = check.conflicts().get(0);
                            conflictDetails = String.format("Conflict for %s (%s as %s)",
                                    first.employeeName(), first.conflictingModule(), first.conflictingRole());
                        }
                    }

                    generated.add(new GeneratedDatePreviewDto(
                            sequence,
                            dateIter,
                            dateIter.getDayOfWeek().name(),
                            start,
                            end,
                            currentWeek,
                            isBuffer,
                            note,
                            hasConflict,
                            conflictDetails
                    ));
                    sequence++;
                }
                dateIter = dateIter.plusDays(1);
            }
        }

        int generatedCount = generated.size();
        int shortfall = Math.max(0, target - generatedCount);
        boolean hasShortfall = shortfall > 0;
        String shortfallMessage = hasShortfall 
                ? "Only " + generatedCount + " of " + target + " sessions fit before the quarter end date (" + maxDate + "). Consider selecting an additional weekday or starting earlier."
                : "All " + target + " sessions successfully distributed across the 12-week schedule window.";

        boolean hasAnyConflict = generated.stream().anyMatch(GeneratedDatePreviewDto::hasConflict);
        String conflictSummary = hasAnyConflict
                ? "Schedule conflict detected: one or more dates overlap with an existing session in Coaching or Mentoring."
                : null;

        return new SeriesPreviewResponse(
                target,
                generatedCount,
                shortfall,
                hasShortfall,
                shortfallMessage,
                hasAnyConflict,
                conflictSummary,
                generated
        );
    }

    @Transactional
    public ScheduleSeriesDto createSeries(CreateScheduleSeriesRequest request, ApidUserPrincipal actor) {
        EmployeeDto caller = employeeQueryService.findByUserId(actor.getUserId())
                .orElseThrow(() -> new AccessDeniedException("No employee profile linked to user account."));

        boolean hasAssignment = request.assignmentId() != null;
        boolean hasSkillReq = request.skillRequestId() != null;
        if ((hasAssignment && hasSkillReq) || (!hasAssignment && !hasSkillReq)) {
            throw new BusinessException("INVALID_PARENT", "A series must link to either a coaching assignment or a skill request.");
        }

        Long coachEmpId;
        AssignmentPathway pathway;
        List<Long> coacheeEmpIds = new ArrayList<>();

        if (hasAssignment) {
            CoachingAssignment assignment = assignmentRepository.findById(request.assignmentId())
                    .orElseThrow(() -> new ResourceNotFoundException("Coaching assignment not found"));
            if (assignment.getStatus() == AssignmentStatus.CLOSED) {
                throw new BusinessException("ASSIGNMENT_CLOSED", "Cannot schedule series for a closed assignment.");
            }
            coachEmpId = assignment.getCoachEmployeeId();
            if (coachEmpId == null) {
                throw new BusinessException("NO_COACH", "No coach assigned to this employee.");
            }
            if (!caller.id().equals(coachEmpId) && !isAdmin(actor)) {
                throw new AccessDeniedException("Only the designated coach can set up a recurring schedule rhythm.");
            }
            pathway = AssignmentPathway.MANDATORY_PMS;
            coacheeEmpIds.add(assignment.getCoacheeEmployeeId());
            if (request.additionalAssignmentIds() != null) {
                for (Long addId : request.additionalAssignmentIds()) {
                    assignmentRepository.findById(addId).ifPresent(addAss -> {
                        if (addAss.getCoacheeEmployeeId() != null && !coacheeEmpIds.contains(addAss.getCoacheeEmployeeId())) {
                            coacheeEmpIds.add(addAss.getCoacheeEmployeeId());
                        }
                    });
                }
            }
        } else {
            SkillCoachingRequest skillReq = skillRequestRepository.findById(request.skillRequestId())
                    .orElseThrow(() -> new ResourceNotFoundException("Skill request not found"));
            if (skillReq.getStatus() != SkillCoachingRequestStatus.APPROVED) {
                throw new BusinessException("NOT_APPROVED", "Skill request must be approved before scheduling.");
            }
            coachEmpId = skillReq.getProposedCoachEmployeeId();
            if (coachEmpId == null || (!caller.id().equals(coachEmpId) && !isAdmin(actor))) {
                throw new AccessDeniedException("Only the designated coach can create a cohort schedule series.");
            }
            pathway = AssignmentPathway.SELF_DEVELOPMENT;
            List<SkillCoachingRequestTarget> targets = skillRequestTargetRepository.findAllByRequestId(skillReq.getId());
            targets.forEach(t -> coacheeEmpIds.add(t.getEmployeeId()));
        }

        // Preview occurrences with participant conflict check
        SeriesPreviewResponse preview = previewSeries(new SeriesPreviewRequest(
                request.firstSessionDate(),
                request.quarterEndDate(),
                request.cadenceType(),
                request.daysOfWeek(),
                request.preferredStartTime(),
                request.durationMinutes(),
                request.targetOccurrences(),
                request.assignmentId(),
                request.skillRequestId(),
                request.additionalAssignmentIds(),
                request.dayStartTimes(),
                request.customSessions()
        ));

        if (preview.generatedOccurrences() == 0) {
            throw new BusinessException("NO_OCCURRENCES_POSSIBLE", "No valid session dates could be generated with the given schedule window.");
        }

        if (preview.hasConflict()) {
            throw new BusinessException("SCHEDULE_CONFLICT", preview.conflictSummary(), HttpStatus.CONFLICT);
        }

        // Save Series
        CoachingScheduleSeries series = new CoachingScheduleSeries();
        series.setAssignmentId(request.assignmentId());
        series.setSkillRequestId(request.skillRequestId());
        series.setCoachEmployeeId(coachEmpId);
        series.setTitle(request.title().trim());
        series.setCadenceType(request.cadenceType());
        series.setDaysOfWeek(request.daysOfWeek());
        series.setPreferredStartTime(request.preferredStartTime());
        series.setDurationMinutes(request.durationMinutes());
        series.setMeetingMode(request.meetingMode() != null ? request.meetingMode() : SessionMeetingMode.VIRTUAL_VIDEO);
        series.setMeetingLocation(request.meetingLocation());
        series.setFirstSessionDate(request.firstSessionDate());
        series.setTargetOccurrences(request.targetOccurrences());
        series.setGeneratedOccurrences(preview.generatedOccurrences());
        series.setStatus(SeriesStatus.ACTIVE);
        series.setCreatedByUserId(actor.getUserId());
        CoachingScheduleSeries savedSeries = seriesRepository.save(series);

        // Batch Generate Sessions and register in Core Scheduling Reservation Authority
        List<CoachingSessionDto> generatedSessions = new ArrayList<>();

        for (GeneratedDatePreviewDto p : preview.previewDates()) {
            Instant startInstant = SchedulingTimezones.toUtcInstant(p.sessionDate(), p.startTime());
            Instant endInstant = SchedulingTimezones.toUtcInstant(p.sessionDate(), p.endTime());

            String roomName = null;
            String roomUrl = null;
            if (series.getMeetingMode().isVideoRequired()) {
                String prefix = hasAssignment ? "pms-" + request.assignmentId() : "skill-" + request.skillRequestId();
                MeetingRoomDetails room = videoMeetingProvider.createRoom(prefix + "-s" + p.sequenceNumber(), endInstant.plus(Duration.ofHours(2)));
                roomName = room.roomName();
                roomUrl = room.roomUrl();
            }

            CoachingSession session = new CoachingSession();
            session.setAssignmentId(request.assignmentId());
            session.setSkillRequestId(request.skillRequestId());
            session.setCoachEmployeeId(coachEmpId);
            session.setTitle(request.title().trim() + " — Session " + p.sequenceNumber());
            session.setPathway(pathway);
            session.setScheduledStartTime(startInstant);
            session.setScheduledEndTime(endInstant);
            session.setDurationMinutes(request.durationMinutes());
            session.setMeetingMode(series.getMeetingMode());
            session.setMeetingLocation(series.getMeetingLocation());
            session.setMeetingProvider(videoMeetingProvider.getProviderName());
            session.setMeetingRoomName(roomName);
            session.setMeetingRoomUrl(roomUrl);
            session.setDailyRoomName(roomName);
            session.setDailyRoomUrl(roomUrl);
            session.setTargetPmsGoalId(request.targetPmsGoalId());
            session.setCreatedByUserId(actor.getUserId());
            session.setStatus(SessionStatus.CONFIRMED);
            session.setSeriesId(savedSeries.getId());
            session.setSequenceNumber(p.sequenceNumber());
            session.setExtensionSession(false);

            CoachingSession savedSession = sessionRepository.save(session);

            // Add Coach participant in coaching schema
            SessionParticipant coachPart = new SessionParticipant();
            coachPart.setSessionId(savedSession.getId());
            coachPart.setEmployeeId(coachEmpId);
            coachPart.setRole(ParticipantRole.COACH);
            coachPart.setInvitationStatus(InvitationStatus.ACCEPTED);
            coachPart.setRespondedAt(Instant.now());
            participantRepository.save(coachPart);

            // Add Coachee participants in coaching schema
            for (Long coacheeId : coacheeEmpIds) {
                SessionParticipant coacheePart = new SessionParticipant();
                coacheePart.setSessionId(savedSession.getId());
                coacheePart.setEmployeeId(coacheeId);
                coacheePart.setRole(ParticipantRole.COACHEE);
                coacheePart.setInvitationStatus(InvitationStatus.PENDING);
                participantRepository.save(coacheePart);
            }

            // Register immutable reservation in Core Scheduling Authority
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
                    startInstant,
                    endInstant,
                    SchedulingTimezones.DEFAULT_ZONE_ID,
                    series.getMeetingMode().name(),
                    series.getMeetingLocation(),
                    savedSession.getMeetingRoomUrl(),
                    resParts
            ));

            generatedSessions.add(sessionService.toDto(savedSession));
        }

        auditService.record(new AuditService.AuditCommand(
                null,
                actor.getUserId(),
                actor.getUsername(),
                null,
                "COACHING",
                "CREATE_SCHEDULE_SERIES",
                "SUCCESS",
                null,
                "COACHING_SCHEDULE_SERIES",
                savedSeries.getId().toString(),
                Map.of("target", request.targetOccurrences(), "generated", preview.generatedOccurrences(), "cadence", request.cadenceType().name()),
                null,
                null
        ));

        String coachName = caller.fullName();
        return new ScheduleSeriesDto(
                savedSeries.getId(),
                savedSeries.getAssignmentId(),
                savedSeries.getSkillRequestId(),
                savedSeries.getCoachEmployeeId(),
                coachName,
                savedSeries.getTitle(),
                savedSeries.getCadenceType(),
                savedSeries.getDaysOfWeek(),
                savedSeries.getPreferredStartTime(),
                savedSeries.getDurationMinutes(),
                savedSeries.getMeetingMode(),
                savedSeries.getMeetingLocation(),
                savedSeries.getFirstSessionDate(),
                savedSeries.getTargetOccurrences(),
                savedSeries.getGeneratedOccurrences(),
                savedSeries.getStatus(),
                generatedSessions,
                savedSeries.getCreatedAt()
        );
    }

    private List<DayOfWeek> parseDaysOfWeek(String daysOfWeek) {
        if (daysOfWeek == null || daysOfWeek.isBlank()) {
            return List.of(DayOfWeek.TUESDAY);
        }
        List<DayOfWeek> list = new ArrayList<>();
        String[] parts = daysOfWeek.split(",");
        for (String p : parts) {
            try {
                list.add(DayOfWeek.valueOf(p.trim().toUpperCase()));
            } catch (Exception e) {
                // Ignore unrecognized
            }
        }
        return list.isEmpty() ? List.of(DayOfWeek.TUESDAY) : list;
    }

    private boolean isAdmin(ApidUserPrincipal actor) {
        return actor != null && actor.getAuthorities().stream()
                .anyMatch(a -> a.getAuthority().equals("ROLE_ADMIN") || a.getAuthority().equals("ROLE_PMS_ADMIN"));
    }
}
