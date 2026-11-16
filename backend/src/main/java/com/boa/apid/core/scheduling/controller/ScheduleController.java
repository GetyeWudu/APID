package com.boa.apid.core.scheduling.controller;

import com.boa.apid.common.response.ApiResponse;
import com.boa.apid.core.auth.security.ApidUserPrincipal;
import com.boa.apid.core.scheduling.dto.AvailabilityCheckRequest;
import com.boa.apid.core.scheduling.dto.AvailabilityCheckResponse;
import com.boa.apid.core.scheduling.dto.ScheduleEventDto;
import com.boa.apid.core.scheduling.service.CalendarQueryService;
import com.boa.apid.core.scheduling.service.ScheduleReservationService;
import jakarta.validation.Valid;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;

@RestController
@RequestMapping("/api/v1/schedule")
public class ScheduleController {

    private final CalendarQueryService calendarQueryService;
    private final ScheduleReservationService reservationService;

    public ScheduleController(
            CalendarQueryService calendarQueryService,
            ScheduleReservationService reservationService
    ) {
        this.calendarQueryService = calendarQueryService;
        this.reservationService = reservationService;
    }

    /**
     * Unified calendar aggregation endpoint returning all active commitments
     * across Coaching, Mentoring, and Training for the authenticated employee.
     */
    @GetMapping("/my-calendar")
    @PreAuthorize("hasAuthority('EMPLOYEE_PORTAL_ACCESS')")
    public ApiResponse<List<ScheduleEventDto>> getMyCalendar(
            @RequestParam(value = "from", required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant from,
            @RequestParam(value = "to", required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant to,
            @AuthenticationPrincipal ApidUserPrincipal actor
    ) {
        Instant effectiveFrom = from != null ? from : Instant.now().minus(7, ChronoUnit.DAYS);
        Instant effectiveTo = to != null ? to : Instant.now().plus(60, ChronoUnit.DAYS);
        return ApiResponse.ok(calendarQueryService.getMyCalendar(actor, effectiveFrom, effectiveTo));
    }

    /**
     * Read-only preview conflict checker for UI scheduling modals before confirming a booking.
     */
    @PostMapping("/check-availability")
    @PreAuthorize("hasAuthority('EMPLOYEE_PORTAL_ACCESS')")
    public ApiResponse<AvailabilityCheckResponse> checkAvailability(
            @Valid @RequestBody AvailabilityCheckRequest request
    ) {
        return ApiResponse.ok(reservationService.checkAvailability(request));
    }
}

