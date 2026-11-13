package com.boa.apid.coaching.session.video;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.annotation.PostConstruct;
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
    private String domainName;
    private final MockVideoMeetingProvider mockProvider;
    private final RestTemplate restTemplate;
    private final ObjectMapper objectMapper;

    public DailyVideoMeetingProvider(
            @Value("${daily.api-base-url:https://api.daily.co/v1}") String apiBaseUrl,
            @Value("${daily.api-key:}") String apiKey,
            @Value("${daily.domain-name:amakari}") String domainName,
            MockVideoMeetingProvider mockProvider
    ) {
        this.apiBaseUrl = apiBaseUrl;
        this.apiKey = apiKey != null ? apiKey.trim() : "";
        this.domainName = domainName != null && !domainName.isBlank() ? domainName.trim() : "amakari";
        this.mockProvider = mockProvider;
        this.restTemplate = new RestTemplate();
        this.objectMapper = new ObjectMapper();
    }

    @PostConstruct
    public void discoverDomain() {
        if (isConfigured()) {
            try {
                HttpHeaders headers = new HttpHeaders();
                headers.setBearerAuth(apiKey);
                HttpEntity<Void> request = new HttpEntity<>(headers);
                ResponseEntity<String> response = restTemplate.exchange(apiBaseUrl + "/", HttpMethod.GET, request, String.class);
                if (response.getStatusCode().is2xxSuccessful() && response.getBody() != null) {
                    JsonNode root = objectMapper.readTree(response.getBody());
                    String discovered = root.path("domain_name").asText();
                    if (discovered != null && !discovered.isBlank()) {
                        this.domainName = discovered.trim();
                        log.info("Successfully discovered Daily.co team domain from API: {}", this.domainName);
                    }
                }
            } catch (Exception ex) {
                log.info("Using configured Daily.co domain: {}", this.domainName);
            }
        }
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
            String cleanPrefix = roomNamePrefix != null 
                    ? roomNamePrefix.replaceAll("[^a-zA-Z0-9_-]", "").toLowerCase() 
                    : "session";
            String roomName = ("boa-" + cleanPrefix + "-" + UUID.randomUUID().toString().substring(0, 8)).toLowerCase();

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
                log.info("Successfully provisioned Daily.co private room: {} ({})", returnedName, returnedUrl);
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
                String urlWithToken = "https://" + domainName + ".daily.co/" + roomName + "?t=" + token;
                log.info("Generated Daily.co meeting token for participant: {} (url: {})", employeeNumber, urlWithToken);
                return new MeetingTokenDetails(token, urlWithToken, expiresAt, false);
            }
        } catch (Exception ex) {
            log.warn("Daily.co API call failed to create token, falling back to mock: {}", ex.getMessage());
        }

        return mockProvider.createParticipantToken(roomName, employeeNumber, fullName, isOwner, expiresAt);
    }

    @Override
    public void deleteRoom(String roomName) {
        if (!isConfigured() || roomName == null || roomName.isBlank()) {
            mockProvider.deleteRoom(roomName);
            return;
        }

        try {
            HttpHeaders headers = new HttpHeaders();
            headers.setBearerAuth(apiKey);
            HttpEntity<Void> request = new HttpEntity<>(headers);
            restTemplate.exchange(apiBaseUrl + "/rooms/" + roomName, HttpMethod.DELETE, request, Void.class);
            log.info("Successfully deleted Daily.co room: {}", roomName);
        } catch (Exception ex) {
            log.warn("Failed to delete Daily.co room {}: {}", roomName, ex.getMessage());
        }
    }
}

