package com.boa.apid.core.health;

import com.boa.apid.common.response.ApiResponse;
import com.boa.apid.platform.ai.api.AIHealthStatus;
import com.boa.apid.platform.ai.api.AIProvider;
import com.boa.apid.platform.video.api.VideoMeetingProvider;
import com.boa.apid.platform.video.livekit.LiveKitConfigProperties;
import com.boa.apid.platform.video.livekit.LiveKitTokenService;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/system/health")
@PreAuthorize("isAuthenticated() and hasAuthority('EMPLOYEE_PORTAL_ACCESS')")
public class SystemIntegrationHealthController {

    private final LiveKitConfigProperties liveKitProperties;
    private final LiveKitTokenService liveKitTokenService;
    private final VideoMeetingProvider videoMeetingProvider;
    private final AIProvider aiProvider;

    public SystemIntegrationHealthController(
            LiveKitConfigProperties liveKitProperties,
            LiveKitTokenService liveKitTokenService,
            VideoMeetingProvider videoMeetingProvider,
            AIProvider aiProvider
    ) {
        this.liveKitProperties = liveKitProperties;
        this.liveKitTokenService = liveKitTokenService;
        this.videoMeetingProvider = videoMeetingProvider;
        this.aiProvider = aiProvider;
    }

    @GetMapping("/livekit")
    public ApiResponse<Map<String, Object>> getLiveKitHealth() {
        Map<String, Object> result = new HashMap<>();
        result.put("provider", videoMeetingProvider.getProviderName());
        result.put("configured", liveKitProperties.isConfigured());
        result.put("publicUrl", liveKitProperties.getPublicUrl());

        boolean tokenGenerationOk = false;
        if (liveKitProperties.isConfigured()) {
            try {
                String testToken = liveKitTokenService.createToken("health-check-room", "BOA-HEALTH-TEST", "Health Test", false, Instant.now().plusSeconds(300));
                tokenGenerationOk = testToken != null && !testToken.isBlank();
            } catch (Exception ex) {
                result.put("tokenError", ex.getMessage());
            }
        }
        result.put("tokenSigningOperational", tokenGenerationOk);

        return ApiResponse.ok(result);
    }

    @GetMapping("/ollama")
    public ApiResponse<AIHealthStatus> getOllamaHealth() {
        AIHealthStatus status = aiProvider.checkHealth();
        return ApiResponse.ok(status);
    }
}
