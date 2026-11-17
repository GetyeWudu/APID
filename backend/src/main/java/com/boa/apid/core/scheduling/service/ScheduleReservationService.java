package com.boa.apid.core.scheduling.service;

import com.boa.apid.common.exception.BusinessException;
import com.boa.apid.common.exception.ResourceNotFoundException;
import com.boa.apid.core.organization.entity.Employee;
import com.boa.apid.core.organization.repository.EmployeeRepository;
import com.boa.apid.core.scheduling.config.SchedulingTimezones;
import com.boa.apid.core.scheduling.dto.*;
import com.boa.apid.core.scheduling.entity.*;
import com.boa.apid.core.scheduling.repository.ScheduleEventRepository;
import com.boa.apid.core.scheduling.repository.ScheduleParticipantRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class ScheduleReservationService {

    private static final Logger log = LoggerFactory.getLogger(ScheduleReservationService.class);

    private final ScheduleEventRepository eventRepository;
    private final ScheduleParticipantRepository participantRepository;
    private final EmployeeRepository employeeRepository;

    public ScheduleReservationService(
            ScheduleEventRepository eventRepository,
            ScheduleParticipantRepository participantRepository,
            EmployeeRepository employeeRepository
    ) {
        this.eventRepository = eventRepository;
        this.participantRepository = participantRepository;
        this.employeeRepository = employeeRepository;
    }

    /**
     * Checks if all requested employees are available during the specified window.
     * Read-only preview query; does not lock database rows.
     */
    @Transactional(readOnly = true)
    public AvailabilityCheckResponse checkAvailability(AvailabilityCheckRequest request) {
        if (request.employeeIds() == null || request.employeeIds().isEmpty()) {
            return AvailabilityCheckResponse.free();
        }

        Long excludeEventId = null;
        if (request.sourceModule() != null && request.excludeSourceSessionId() != null) {
            excludeEventId = eventRepository.findBySourceModuleAndSourceSessionId(request.sourceModule(), request.excludeSourceSessionId())
                    .map(ScheduleEvent::getId)
                    .orElse(null);
        }

        List<ScheduleParticipant> conflicts = participantRepository.findConflictingReservations(
                request.employeeIds(),
                request.startAt(),
                request.endAt(),
                excludeEventId
        );

        if (conflicts.isEmpty()) {
            return AvailabilityCheckResponse.free();
        }

        List<ConflictDescriptor> descriptors = conflicts.stream().map(p -> {
            Employee emp = p.getEmployee();
            ScheduleEvent ev = p.getScheduleEvent();
            return new ConflictDescriptor(
                    p.getEmployeeId(),
                    emp != null ? emp.getFullName() : "Staff #" + p.getEmployeeId(),
                    emp != null ? emp.getEmployeeNumber() : "—",
                    ev.getSourceModule(),
                    p.getParticipationRole(),
                    ev.getStartAt(),
                    ev.getEndAt(),
                    ev.getTitle()
            );
        }).collect(Collectors.toList());

        return AvailabilityCheckResponse.conflict(descriptors);
    }

    private String formatConflictMessage(String prefix, ConflictDescriptor conflict) {
        java.time.ZonedDateTime startZoned = SchedulingTimezones.toLocalZoned(conflict.startAt());
        java.time.ZonedDateTime endZoned = SchedulingTimezones.toLocalZoned(conflict.endAt());
        String dateStr = startZoned.toLocalDate().toString();
        String timeStr = String.format("%02d:%02d - %02d:%02d EAT",
                startZoned.getHour(), startZoned.getMinute(),
                endZoned.getHour(), endZoned.getMinute()
        );
        String sessionTitle = conflict.sessionTitle() != null && !conflict.sessionTitle().isBlank()
                ? String.format(" ('%s')", conflict.sessionTitle().trim())
                : "";
        return String.format("%s: %s is already booked for [%s%s] as %s on %s at %s.",
                prefix,
                conflict.employeeName(),
                conflict.conflictingModule(),
                sessionTitle,
                conflict.conflictingRole(),
                dateStr,
                timeStr
        );
    }

    /**
     * Authoritative reservation: validates availability and creates immutable reservations.
     * Protected by PostgreSQL btree_gist exclusion constraint against race conditions.
     */
    @Transactional
    public ScheduleEventDto reserve(CreateReservationCommand command) {
        // 1. Proactive pre-check
        List<Long> empIds = command.participants().stream()
                .map(CreateReservationCommand.ParticipantReservationInput::employeeId)
                .distinct()
                .collect(Collectors.toList());

        AvailabilityCheckResponse check = checkAvailability(new AvailabilityCheckRequest(
                empIds,
                command.startAt(),
                command.endAt(),
                command.sourceModule(),
                command.sourceSessionId()
        ));

        if (!check.available()) {
            ConflictDescriptor first = check.conflicts().get(0);
            throw new BusinessException("SCHEDULE_CONFLICT", formatConflictMessage("Scheduling conflict", first), HttpStatus.CONFLICT);
        }

        // 2. Persist Event
        ScheduleEvent event = eventRepository.findBySourceModuleAndSourceSessionId(command.sourceModule(), command.sourceSessionId())
                .orElseGet(ScheduleEvent::new);

        event.setSourceModule(command.sourceModule());
        event.setSourceSessionId(command.sourceSessionId());
        event.setTitle(command.title().trim());
        event.setStartAt(command.startAt());
        event.setEndAt(command.endAt());
        event.setTimezone(command.timezone() != null ? command.timezone() : SchedulingTimezones.DEFAULT_ZONE_ID);
        event.setStatus(ScheduleEventStatus.CONFIRMED);
        event.setMeetingMode(command.meetingMode());
        event.setMeetingLocation(command.meetingLocation());
        event.setVideoCallUrl(command.videoCallUrl());

        // Clear previous participants if updating existing
        event.getParticipants().clear();

        for (CreateReservationCommand.ParticipantReservationInput input : command.participants()) {
            ScheduleParticipant p = new ScheduleParticipant(event, input.employeeId(), input.role());
            event.addParticipant(p);
        }

        try {
            ScheduleEvent saved = eventRepository.saveAndFlush(event);
            return toDto(saved, null);
        } catch (DataIntegrityViolationException ex) {
            log.warn("Database-level concurrency exclusion caught on reserve: {}", ex.getMessage());
            throw new BusinessException("SCHEDULE_CONFLICT", "A concurrent booking was confirmed for one of the participants. Please pick another time slot.", HttpStatus.CONFLICT);
        }
    }

    /**
     * Reschedules an existing event to a new time window.
     */
    @Transactional
    public ScheduleEventDto reschedule(String sourceModule, Long sourceSessionId, Instant newStart, Instant newEnd) {
        ScheduleEvent event = eventRepository.findBySourceModuleAndSourceSessionId(sourceModule, sourceSessionId)
                .orElseThrow(() -> new ResourceNotFoundException("Scheduled event not found"));

        List<Long> empIds = event.getParticipants().stream()
                .map(ScheduleParticipant::getEmployeeId)
                .collect(Collectors.toList());

        AvailabilityCheckResponse check = checkAvailability(new AvailabilityCheckRequest(
                empIds,
                newStart,
                newEnd,
                sourceModule,
                sourceSessionId
        ));

        if (!check.available()) {
            ConflictDescriptor first = check.conflicts().get(0);
            throw new BusinessException("SCHEDULE_CONFLICT", formatConflictMessage("Reschedule conflict", first), HttpStatus.CONFLICT);
        }

        event.setStartAt(newStart);
        event.setEndAt(newEnd);
        event.setStatus(ScheduleEventStatus.CONFIRMED);

        try {
            ScheduleEvent saved = eventRepository.saveAndFlush(event);
            return toDto(saved, null);
        } catch (DataIntegrityViolationException ex) {
            throw new BusinessException("SCHEDULE_CONFLICT", "A concurrent booking conflict prevented rescheduling.", HttpStatus.CONFLICT);
        }
    }

    /**
     * Releases reservations when an event is cancelled.
     */
    @Transactional
    public void release(String sourceModule, Long sourceSessionId, String reason) {
        eventRepository.findBySourceModuleAndSourceSessionId(sourceModule, sourceSessionId)
                .ifPresent(event -> {
                    event.setStatus(ScheduleEventStatus.CANCELLED);
                    for (ScheduleParticipant p : event.getParticipants()) {
                        p.setReservationStatus(ReservationStatus.RELEASED);
                    }
                    eventRepository.save(event);
                });
    }

    /**
     * Marks event as completed.
     */
    @Transactional
    public void complete(String sourceModule, Long sourceSessionId) {
        eventRepository.findBySourceModuleAndSourceSessionId(sourceModule, sourceSessionId)
                .ifPresent(event -> {
                    event.setStatus(ScheduleEventStatus.COMPLETED);
                    eventRepository.save(event);
                });
    }

    public ScheduleEventDto toDto(ScheduleEvent event, Long viewerEmployeeId) {
        ParticipationRole myRole = null;
        List<ScheduleEventDto.ScheduleParticipantDto> participantDtos = new ArrayList<>();

        for (ScheduleParticipant p : event.getParticipants()) {
            Employee emp = employeeRepository.findById(p.getEmployeeId()).orElse(null);
            if (viewerEmployeeId != null && p.getEmployeeId().equals(viewerEmployeeId)) {
                myRole = p.getParticipationRole();
            }
            participantDtos.add(new ScheduleEventDto.ScheduleParticipantDto(
                    p.getId(),
                    p.getEmployeeId(),
                    emp != null ? emp.getFullName() : "Employee #" + p.getEmployeeId(),
                    emp != null ? emp.getEmployeeNumber() : "—",
                    p.getParticipationRole(),
                    p.getReservationStatus()
            ));
        }

        return new ScheduleEventDto(
                event.getId(),
                event.getSourceModule(),
                event.getSourceSessionId(),
                event.getTitle(),
                event.getStartAt(),
                event.getEndAt(),
                event.getTimezone(),
                event.getStatus(),
                event.getMeetingMode(),
                event.getMeetingLocation(),
                event.getVideoCallUrl(),
                myRole,
                participantDtos
        );
    }
}

