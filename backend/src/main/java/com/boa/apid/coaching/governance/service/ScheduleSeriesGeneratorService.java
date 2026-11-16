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
import com.boa.apid.coaching.session.video.MeetingRoomDetails;
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
import com.boa.apid.core.organization.service.EmployeeQueryService;
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

    public ScheduleSeriesGeneratorService(
            CoachingScheduleSeriesRepository seriesRepository,
            CoachingSessionRepository sessionRepository,
            SessionParticipantRepository participantRepository,
            CoachingAssignmentRepository assignmentRepository,
            SkillCoachingRequestRepository skillRequestRepository,
            SkillCoachingRequestTargetRepository skillRequestTargetRepository,
            EmployeeQueryService employeeQueryService,
            VideoMeetingProvider videoMeetingProvider,
            AuditService auditService
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
    }

    public SeriesPreviewResponse previewSeries(SeriesPreviewRequest request) {
        LocalDate startDate = request.firstSessionDate();
        LocalDate maxDate = request.quarterEndDate() != null 
                ? request.quarterEndDate() 
                : startDate.plusWeeks(12);

        List<DayOfWeek> days = parseDaysOfWeek(request.daysOfWeek());
        List<GeneratedDatePreviewDto> generated = new ArrayList<>();

        LocalDate cursor = startDate;
        int target = request.targetOccurrences();
        int sequence = 1;
        int weekIndex = 1;

        if (request.cadenceType() == CadenceType.TWICE_WEEKLY && days.size() < 2) {
            // Default to Tuesday and Thursday if only 1 day provided for twice weekly
            days = List.of(DayOfWeek.TUESDAY, DayOfWeek.THURSDAY);
        }

        // Loop forward across calendar
        while (!cursor.isAfter(maxDate) && sequence <= target) {
            for (DayOfWeek targetDay : days) {
                // Find next matching date on or after cursor
                LocalDate nextOccurrence = cursor;
                while (nextOccurrence.getDayOfWeek() != targetDay && !nextOccurrence.isAfter(maxDate)) {
                    nextOccurrence = nextOccurrence.plusDays(1);
                }

                if (!nextOccurrence.isAfter(maxDate) && sequence <= target) {
                    LocalTime start = request.preferredStartTime();
                    LocalTime end = start.plusMinutes(request.durationMinutes());
                    
                    int currentWeek = (int) (java.time.temporal.ChronoUnit.DAYS.between(startDate, nextOccurrence) / 7) + 1;
                    boolean isBuffer = (currentWeek == 6 || currentWeek == 12);
                    String note = isBuffer ? "Quarter checkpoint / buffer window" : "Standard coaching session";

                    generated.add(new GeneratedDatePreviewDto(
                            sequence,
                            nextOccurrence,
                            targetDay.name(),
                            start,
                            end,
                            currentWeek,
                            isBuffer,
                            note
                    ));
                    sequence++;
                }
            }

            // Advance cursor according to cadence
            if (request.cadenceType() == CadenceType.WEEKLY) {
                cursor = cursor.plusWeeks(1);
            } else if (request.cadenceType() == CadenceType.BIWEEKLY) {
                cursor = cursor.plusWeeks(2);
            } else if (request.cadenceType() == CadenceType.TWICE_WEEKLY) {
                cursor = cursor.plusWeeks(1);
            } else {
                cursor = cursor.plusWeeks(1);
            }
        }

        int generatedCount = generated.size();
        int shortfall = Math.max(0, target - generatedCount);
        boolean hasShortfall = shortfall > 0;
        String shortfallMessage = hasShortfall 
                ? "Only " + generatedCount + " of " + target + " sessions fit before the quarter end date (" + maxDate + "). Consider selecting an additional weekday or starting earlier."
                : "All " + target + " sessions successfully distributed across the 12-week schedule window.";

        return new SeriesPreviewResponse(
                target,
                generatedCount,
                shortfall,
                hasShortfall,
                shortfallMessage,
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

        // Preview occurrences
        SeriesPreviewResponse preview = previewSeries(new SeriesPreviewRequest(
                request.firstSessionDate(),
                request.quarterEndDate(),
                request.cadenceType(),
                request.daysOfWeek(),
                request.preferredStartTime(),
                request.durationMinutes(),
                request.targetOccurrences()
        ));

        if (preview.generatedOccurrences() == 0) {
            throw new BusinessException("NO_OCCURRENCES_POSSIBLE", "No valid session dates could be generated with the given schedule window.");
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

        // Batch Generate Sessions
        ZoneId zone = ZoneId.of("UTC"); // Standard UTC representation for DB timestamp
        List<CoachingSessionDto> generatedSessions = new ArrayList<>();

        for (GeneratedDatePreviewDto p : preview.previewDates()) {
            ZonedDateTime zdtStart = ZonedDateTime.of(p.sessionDate(), p.startTime(), zone);
            Instant startInstant = zdtStart.toInstant();
            Instant endInstant = startInstant.plus(Duration.ofMinutes(request.durationMinutes()));

            String dailyRoomName = null;
            String dailyRoomUrl = null;
            if (series.getMeetingMode() == SessionMeetingMode.VIRTUAL_VIDEO) {
                String prefix = hasAssignment ? "pms-" + request.assignmentId() : "skill-" + request.skillRequestId();
                MeetingRoomDetails room = videoMeetingProvider.createRoom(prefix + "-s" + p.sequenceNumber(), endInstant.plus(Duration.ofHours(2)));
                dailyRoomName = room.roomName();
                dailyRoomUrl = room.roomUrl();
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
            session.setDailyRoomName(dailyRoomName);
            session.setDailyRoomUrl(dailyRoomUrl);
            session.setTargetPmsGoalId(request.targetPmsGoalId());
            session.setCreatedByUserId(actor.getUserId());
            session.setStatus(SessionStatus.CONFIRMED);
            session.setSeriesId(savedSeries.getId());
            session.setSequenceNumber(p.sequenceNumber());
            session.setExtensionSession(false);

            CoachingSession savedSession = sessionRepository.save(session);

            // Add Coach participant
            SessionParticipant coachPart = new SessionParticipant();
            coachPart.setSessionId(savedSession.getId());
            coachPart.setEmployeeId(coachEmpId);
            coachPart.setRole(ParticipantRole.COACH);
            coachPart.setInvitationStatus(InvitationStatus.ACCEPTED);
            coachPart.setRespondedAt(Instant.now());
            participantRepository.save(coachPart);

            // Add Coachee participants
            for (Long coacheeId : coacheeEmpIds) {
                SessionParticipant coacheePart = new SessionParticipant();
                coacheePart.setSessionId(savedSession.getId());
                coacheePart.setEmployeeId(coacheeId);
                coacheePart.setRole(ParticipantRole.COACHEE);
                coacheePart.setInvitationStatus(InvitationStatus.PENDING);
                participantRepository.save(coacheePart);
            }
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
