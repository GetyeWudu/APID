package com.boa.apid.coaching.session.video;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Primary;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.time.Instant;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

@Service
@Primary
public class DailyVideoMeetingProvider implements VideoMeetingProvider {

    private static final Logger log = LoggerFactory.getLogger(DailyVideoMeetingProvider.class);

    private final String apiBaseUrl;
    private final String apiKey;
    private final MockVideoMeetingProvider mockProvider;
    private final RestTemplate restTemplate;
    private final ObjectMapper objectMapper;

    public DailyVideoMeetingProvider(
            @Value("${daily.api-base-url:https://api.daily.co/v1}") String apiBaseUrl,
            @Value("${daily.api-key:}") String apiKey,
            MockVideoMeetingProvider mockProvider
    ) {
        this.apiBaseUrl = apiBaseUrl;
        this.apiKey = apiKey != null ? apiKey.trim() : "";
        this.mockProvider = mockProvider;
        this.restTemplate = new RestTemplate();
        this.objectMapper = new ObjectMapper();
    }

    private boolean isConfigured() {
        return !apiKey.isBlank() && !apiKey.startsWith("replace-with");
    }

    @Override
    public MeetingRoomDetails createRoom(String roomNamePrefix, Instant expiresAt) {
        if (!isConfigured()) {
            return mockProvider.createRoom(roomNamePrefix, expiresAt);
        }

        try {
            String cleanPrefix = roomNamePrefix != null ? roomNamePrefix.replaceAll("[^a-zA-Z0-9_-]", "") : "session";
            String roomName = "boa-" + cleanPrefix + "-" + UUID.randomUUID().toString().substring(0, 8);

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            headers.setBearerAuth(apiKey);

            Map<String, Object> properties = new HashMap<>();
            if (expiresAt != null) {
                properties.put("exp", expiresAt.getEpochSecond());
            }
            properties.put("enable_chat", true);
            properties.put("enable_screenshare", true);
            properties.put("enable_prejoin_ui", false);

            Map<String, Object> body = new HashMap<>();
            body.put("name", roomName);
            body.put("privacy", "private");
            body.put("properties", properties);

            HttpEntity<Map<String, Object>> request = new HttpEntity<>(body, headers);
            ResponseEntity<String> response = restTemplate.postForEntity(apiBaseUrl + "/rooms", request, String.class);

            if (response.getStatusCode().is2xxSuccessful() && response.getBody() != null) {
                JsonNode root = objectMapper.readTree(response.getBody());
                String returnedName = root.path("name").asText(roomName);
                String returnedUrl = root.path("url").asText();
                log.info("Successfully provisioned Daily.co private room: {}", returnedName);
                return new MeetingRoomDetails(returnedName, returnedUrl, expiresAt, false);
            }
        } catch (Exception ex) {
            log.warn("Daily.co API call failed to create room, falling back to mock: {}", ex.getMessage());
        }

        return mockProvider.createRoom(roomNamePrefix, expiresAt);
    }

    @Override
    public MeetingTokenDetails createParticipantToken(
            String roomName,
            String employeeNumber,
            String fullName,
            boolean isOwner,
            Instant expiresAt
    ) {
        if (!isConfigured()) {
            return mockProvider.createParticipantToken(roomName, employeeNumber, fullName, isOwner, expiresAt);
        }

        try {
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            headers.setBearerAuth(apiKey);

            Map<String, Object> properties = new HashMap<>();
            properties.put("room_name", roomName);
            properties.put("user_name", fullName != null ? fullName : "Employee #" + employeeNumber);
            properties.put("is_owner", isOwner);
            if (expiresAt != null) {
                properties.put("exp", expiresAt.getEpochSecond());
            }

            Map<String, Object> body = new HashMap<>();
            body.put("properties", properties);

            HttpEntity<Map<String, Object>> request = new HttpEntity<>(body, headers);
            ResponseEntity<String> response = restTemplate.postForEntity(apiBaseUrl + "/meeting-tokens", request, String.class);

            if (response.getStatusCode().is2xxSuccessful() && response.getBody() != null) {
                JsonNode root = objectMapper.readTree(response.getBody());
                String token = root.path("token").asText();
                String urlWithToken = "https://" + roomName + ".daily.co/" + roomName + "?t=" + token;
                log.info("Generated Daily.co meeting token for participant: {}", employeeNumber);
                return new MeetingTokenDetails(token, urlWithToken, expiresAt, false);
            }
        } catch (Exception ex) {
            log.warn("Daily.co API call failed to create token, falling back to mock: {}", ex.getMessage());
        }

        return mockProvider.createParticipantToken(roomName, employeeNumber, fullName, isOwner, expiresAt);
    }
}

