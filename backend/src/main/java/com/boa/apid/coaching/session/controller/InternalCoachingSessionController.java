package com.boa.apid.coaching.session.controller;

import com.boa.apid.coaching.session.dto.CoachingSessionDto;
import com.boa.apid.coaching.session.dto.CoachingSessionTurnDto;
import com.boa.apid.coaching.session.dto.CreateSessionTurnRequest;
import com.boa.apid.coaching.session.dto.PrefillMinutesRequest;
import com.boa.apid.coaching.session.service.CoachingSessionService;
import com.boa.apid.common.response.ApiResponse;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/coaching/sessions/internal")
public class InternalCoachingSessionController {

    private final CoachingSessionService sessionService;

    public InternalCoachingSessionController(CoachingSessionService sessionService) {
        this.sessionService = sessionService;
    }

    @GetMapping("/by-room/{roomName}/config")
    public ApiResponse<CoachingSessionService.RoomAiConfigDto> getRoomConfig(@PathVariable String roomName) {
        return ApiResponse.ok(sessionService.getRoomAiConfig(roomName));
    }

    @PostMapping("/by-room/{roomName}/turns")
    public ApiResponse<CoachingSessionTurnDto> recordTurn(
            @PathVariable String roomName,
            @Valid @RequestBody CreateSessionTurnRequest request
    ) {
        return ApiResponse.ok(sessionService.recordTurnByRoom(roomName, request));
    }

    @PostMapping("/by-room/{roomName}/prefill-minutes")
    public ApiResponse<CoachingSessionDto> prefillMinutes(
            @PathVariable String roomName,
            @RequestBody PrefillMinutesRequest request
    ) {
        return ApiResponse.ok(sessionService.prefillMinutesByRoom(roomName, request));
    }
}
