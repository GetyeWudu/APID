package com.boa.apid.coaching.session.service;

import com.boa.apid.coaching.session.dto.GeneratedMinutesDto;
import com.boa.apid.coaching.session.entity.CoachingSession;
import com.boa.apid.coaching.session.entity.ParticipantRole;
import com.boa.apid.coaching.session.entity.SessionParticipant;
import com.boa.apid.coaching.session.repository.SessionParticipantRepository;
import com.boa.apid.common.exception.BusinessException;
import com.boa.apid.core.organization.entity.Employee;
import com.boa.apid.core.organization.repository.EmployeeRepository;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
public class MinutesGenerationService {

    private static final Logger log = LoggerFactory.getLogger(MinutesGenerationService.class);

    private final String minutesUrl;
    private final SessionParticipantRepository participantRepository;
    private final EmployeeRepository employeeRepository;
    private final ObjectMapper objectMapper;
    private final HttpClient httpClient;

    public MinutesGenerationService(
            @Value("${apid.ai.minutes-url:http://10.9.36.155:8002/generate-minutes}") String minutesUrl,
            SessionParticipantRepository participantRepository,
            EmployeeRepository employeeRepository,
            ObjectMapper objectMapper
    ) {
        this.minutesUrl = minutesUrl;
        this.participantRepository = participantRepository;
        this.employeeRepository = employeeRepository;
        this.objectMapper = objectMapper;
        this.httpClient = HttpClient.newBuilder()
                .version(HttpClient.Version.HTTP_1_1)
                .connectTimeout(Duration.ofSeconds(15))
                .build();
    }

    public GeneratedMinutesDto generateMinutes(CoachingSession session, MultipartFile audioFile) {
        if (audioFile == null || audioFile.isEmpty()) {
            throw new BusinessException("AUDIO_FILE_REQUIRED", "Please provide a recorded audio file (.wav, .ogg, .mp3, .m4a) to generate minutes.");
        }

        try {
            String boundary = "APIDBoundary" + UUID.randomUUID().toString().replace("-", "");
            ByteArrayOutputStream byteStream = new ByteArrayOutputStream();

            // 1. Audio file part
            String filename = audioFile.getOriginalFilename() != null ? audioFile.getOriginalFilename() : "audio.wav";
            String contentType = audioFile.getContentType() != null ? audioFile.getContentType() : "audio/wav";

            byteStream.write(("--" + boundary + "\r\n").getBytes(StandardCharsets.UTF_8));
            byteStream.write(("Content-Disposition: form-data; name=\"file\"; filename=\"" + filename + "\"\r\n").getBytes(StandardCharsets.UTF_8));
            byteStream.write(("Content-Type: " + contentType + "\r\n\r\n").getBytes(StandardCharsets.UTF_8));
            byteStream.write(audioFile.getBytes());
            byteStream.write("\r\n".getBytes(StandardCharsets.UTF_8));

            // 2. Metadata parts
            writeFormField(byteStream, boundary, "session_title", session.getTitle() != null ? session.getTitle() : "Coaching Session");

            String coachName = resolveCoachName(session.getCoachEmployeeId());
            writeFormField(byteStream, boundary, "coach_name", coachName);

            String coacheeName = resolveCoacheeName(session.getId());
            writeFormField(byteStream, boundary, "coachee_name", coacheeName);

            // Close boundary
            byteStream.write(("--" + boundary + "--\r\n").getBytes(StandardCharsets.UTF_8));

            byte[] requestBody = byteStream.toByteArray();
            log.info("Sending audio ({} bytes) to AI minutes service at: {}", requestBody.length, minutesUrl);

            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(minutesUrl))
                    .timeout(Duration.ofSeconds(120))
                    .header("Content-Type", "multipart/form-data; boundary=" + boundary)
                    .POST(HttpRequest.BodyPublishers.ofByteArray(requestBody))
                    .build();

            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());

            if (response.statusCode() != 200) {
                log.error("AI minutes service returned status {}: {}", response.statusCode(), response.body());
                throw new BusinessException("AI_SERVICE_ERROR", "AI Minutes Service error (" + response.statusCode() + "): " + response.body());
            }

            Map<String, Object> respMap = objectMapper.readValue(response.body(), new TypeReference<>() {});

            String sessionNotes = (String) respMap.getOrDefault("sessionNotesMinutes", "");
            String actionItems = (String) respMap.getOrDefault("actionItems", "");

            @SuppressWarnings("unchecked")
            List<String> keyTopics = (List<String>) respMap.getOrDefault("keyTopics", List.of());

            @SuppressWarnings("unchecked")
            Map<String, String> rawCandidates = (Map<String, String>) respMap.getOrDefault("rawCandidates", Map.of());

            return new GeneratedMinutesDto(sessionNotes, actionItems, keyTopics, rawCandidates);

        } catch (BusinessException be) {
            throw be;
        } catch (Exception e) {
            log.error("Exception during AI minutes generation: {}", e.getMessage(), e);
            throw new BusinessException("AI_GENERATION_FAILED", "Failed to generate meeting minutes from audio: " + e.getMessage());
        }
    }

    private void writeFormField(ByteArrayOutputStream out, String boundary, String name, String value) throws IOException {
        out.write(("--" + boundary + "\r\n").getBytes(StandardCharsets.UTF_8));
        out.write(("Content-Disposition: form-data; name=\"" + name + "\"\r\n\r\n").getBytes(StandardCharsets.UTF_8));
        out.write(value.getBytes(StandardCharsets.UTF_8));
        out.write("\r\n".getBytes(StandardCharsets.UTF_8));
    }

    private String resolveCoachName(Long coachEmpId) {
        if (coachEmpId == null) return "Coach";
        return employeeRepository.findById(coachEmpId)
                .map(Employee::getFullName)
                .orElse("Coach");
    }

    private String resolveCoacheeName(Long sessionId) {
        List<SessionParticipant> parts = participantRepository.findAllBySessionIdOrderByRoleAsc(sessionId);
        for (SessionParticipant p : parts) {
            if (p.getRole() == ParticipantRole.COACHEE) {
                return employeeRepository.findById(p.getEmployeeId())
                        .map(Employee::getFullName)
                        .orElse("Coachee");
            }
        }
        return "Coachee";
    }
}
