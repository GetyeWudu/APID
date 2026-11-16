package com.boa.apid.core.scheduling.service;

import com.boa.apid.core.auth.security.ApidUserPrincipal;
import com.boa.apid.core.organization.entity.Employee;
import com.boa.apid.core.organization.repository.EmployeeRepository;
import com.boa.apid.core.scheduling.dto.ScheduleEventDto;
import com.boa.apid.core.scheduling.entity.ScheduleParticipant;
import com.boa.apid.core.scheduling.repository.ScheduleParticipantRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.Collections;
import java.util.List;
import java.util.stream.Collectors;

@Service
public class CalendarQueryService {

    private final ScheduleParticipantRepository participantRepository;
    private final EmployeeRepository employeeRepository;
    private final ScheduleReservationService reservationService;

    public CalendarQueryService(
            ScheduleParticipantRepository participantRepository,
            EmployeeRepository employeeRepository,
            ScheduleReservationService reservationService
    ) {
        this.participantRepository = participantRepository;
        this.employeeRepository = employeeRepository;
        this.reservationService = reservationService;
    }

    @Transactional(readOnly = true)
    public List<ScheduleEventDto> getMyCalendar(ApidUserPrincipal actor, Instant fromInstant, Instant toInstant) {
        Employee employee = employeeRepository.findByUserId(actor.getUserId()).orElse(null);
        if (employee == null) {
            return Collections.emptyList();
        }

        List<ScheduleParticipant> myParticipants = participantRepository.findMyActiveCalendarEvents(
                employee.getId(),
                fromInstant,
                toInstant
        );

        return myParticipants.stream()
                .map(p -> reservationService.toDto(p.getScheduleEvent(), employee.getId()))
                .collect(Collectors.toList());
    }
}

