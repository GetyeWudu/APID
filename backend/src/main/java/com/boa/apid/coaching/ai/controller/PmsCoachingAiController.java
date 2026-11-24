package com.boa.apid.coaching.ai.controller;

import com.boa.apid.coaching.ai.dto.AiCopilotRequestDto;
import com.boa.apid.coaching.ai.dto.AiCopilotResponseDto;
import com.boa.apid.coaching.ai.dto.AiExecutiveBriefingDto;
import com.boa.apid.coaching.ai.service.PmsCoachingAiService;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.util.Map;

@RestController
@RequestMapping("/api/v1/coaching/ai")
@PreAuthorize("hasAnyAuthority('ROLE_ADMIN', 'PMS_REPORT_UPLOAD', 'COACHING_REQUEST_APPROVE', 'COACHING_INITIATIVE_CREATE', 'COACHING_COACH_REPLACE')")
public class PmsCoachingAiController {

    private final PmsCoachingAiService aiService;

    public PmsCoachingAiController(PmsCoachingAiService aiService) {
        this.aiService = aiService;
    }

    @GetMapping("/briefing")
    public ResponseEntity<AiExecutiveBriefingDto> getExecutiveBriefing(
            @RequestParam(name = "quarterId", required = false) Long quarterId,
            @RequestParam(name = "force", required = false, defaultValue = "false") boolean force
    ) {
        return ResponseEntity.ok(aiService.getExecutiveBriefing(quarterId, force));
    }

    @PostMapping("/ask")
    public ResponseEntity<AiCopilotResponseDto> askCopilot(
            @RequestBody AiCopilotRequestDto request
    ) {
        String query = request != null ? request.query() : "";
        Long quarterId = request != null ? request.quarterId() : null;
        return ResponseEntity.ok(aiService.askCopilot(query, quarterId));
    }

    @PostMapping(value = "/ask/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter askCopilotStream(
            @RequestBody AiCopilotRequestDto request
    ) {
        String query = request != null ? request.query() : "";
        Long quarterId = request != null ? request.quarterId() : null;
        return aiService.askCopilotStream(query, quarterId);
    }

    @GetMapping("/health")
    public ResponseEntity<Map<String, Object>> getAiHealth() {
        return ResponseEntity.ok(Map.of(
                "status", "UP",
                "model", "qwen3:8b",
                "host", "10.9.36.155:11434",
                "provider", "ollama-gpu"
        ));
    }
}
