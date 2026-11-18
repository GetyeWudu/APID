package com.boa.apid.platform.ai.ollama;

import com.boa.apid.platform.ai.api.*;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Primary;
import org.springframework.http.*;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.time.Duration;
import java.util.*;

@Service
@Primary
public class OllamaAIProvider implements AIProvider {

    private static final Logger log = LoggerFactory.getLogger(OllamaAIProvider.class);

    private final OllamaConfigProperties properties;
    private final RestTemplate restTemplate;
    private final ObjectMapper objectMapper;

    public OllamaAIProvider(OllamaConfigProperties properties) {
        this.properties = properties;
        this.objectMapper = new ObjectMapper();

        SimpleClientHttpRequestFactory requestFactory = new SimpleClientHttpRequestFactory();
        int timeoutMs = Math.max(10, properties.getTimeoutSeconds()) * 1000;
        requestFactory.setConnectTimeout(5000);
        requestFactory.setReadTimeout(timeoutMs);
        this.restTemplate = new RestTemplate(requestFactory);
    }

    @Override
    public AIResponse generate(String prompt, AIRequestOptions options) {
        long start = System.currentTimeMillis();
        try {
            String url = getCleanBaseUrl() + "/api/generate";
            Map<String, Object> body = new HashMap<>();
            body.put("model", properties.getModel());
            body.put("prompt", prompt);
            body.put("stream", false);

            if (options != null && options.format() != null) {
                body.put("format", options.format());
            }

            if (options != null && options.temperature() != null) {
                Map<String, Object> opts = new HashMap<>();
                opts.put("temperature", options.temperature());
                body.put("options", opts);
            }

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            HttpEntity<Map<String, Object>> request = new HttpEntity<>(body, headers);

            ResponseEntity<String> response = restTemplate.postForEntity(url, request, String.class);
            if (response.getStatusCode().is2xxSuccessful() && response.getBody() != null) {
                JsonNode root = objectMapper.readTree(response.getBody());
                String rawResponse = root.path("response").asText("");
                String cleanContent = stripThinking(rawResponse);
                long duration = System.currentTimeMillis() - start;
                return AIResponse.ok(cleanContent, properties.getModel(), duration);
            }

            return AIResponse.error("HTTP " + response.getStatusCode().value() + " from Ollama", properties.getModel());
        } catch (Exception ex) {
            log.error("Failed to generate from Ollama model: {}", properties.getModel(), ex);
            return AIResponse.error(ex.getMessage(), properties.getModel());
        }
    }

    @Override
    public AIChatResponse chat(List<AIChatMessage> messages, AIRequestOptions options) {
        long start = System.currentTimeMillis();
        try {
            String url = getCleanBaseUrl() + "/api/chat";

            List<Map<String, String>> msgList = new ArrayList<>();
            for (AIChatMessage m : messages) {
                Map<String, String> item = new HashMap<>();
                item.put("role", m.role());
                item.put("content", m.content());
                msgList.add(item);
            }

            Map<String, Object> body = new HashMap<>();
            body.put("model", properties.getModel());
            body.put("messages", msgList);
            body.put("stream", false);

            if (options != null && options.format() != null) {
                body.put("format", options.format());
            }

            if (options != null && options.temperature() != null) {
                Map<String, Object> opts = new HashMap<>();
                opts.put("temperature", options.temperature());
                body.put("options", opts);
            }

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            HttpEntity<Map<String, Object>> request = new HttpEntity<>(body, headers);

            ResponseEntity<String> response = restTemplate.postForEntity(url, request, String.class);
            if (response.getStatusCode().is2xxSuccessful() && response.getBody() != null) {
                JsonNode root = objectMapper.readTree(response.getBody());
                JsonNode messageNode = root.path("message");
                String rawContent = messageNode.path("content").asText("");
                String cleanContent = stripThinking(rawContent);
                long duration = System.currentTimeMillis() - start;

                AIChatMessage responseMsg = AIChatMessage.assistant(cleanContent);
                return AIChatResponse.ok(responseMsg, properties.getModel(), duration);
            }

            return AIChatResponse.error("HTTP " + response.getStatusCode().value() + " from Ollama", properties.getModel());
        } catch (Exception ex) {
            log.error("Failed to execute chat with Ollama model: {}", properties.getModel(), ex);
            return AIChatResponse.error(ex.getMessage(), properties.getModel());
        }
    }

    @Override
    public boolean isModelAvailable(String modelName) {
        try {
            String url = getCleanBaseUrl() + "/api/tags";
            ResponseEntity<String> response = restTemplate.getForEntity(url, String.class);
            if (response.getStatusCode().is2xxSuccessful() && response.getBody() != null) {
                JsonNode root = objectMapper.readTree(response.getBody());
                JsonNode models = root.path("models");
                if (models.isArray()) {
                    for (JsonNode m : models) {
                        String name = m.path("name").asText();
                        if (name.equalsIgnoreCase(modelName) || name.startsWith(modelName + ":")) {
                            return true;
                        }
                    }
                }
            }
        } catch (Exception ex) {
            log.warn("Failed to query Ollama /api/tags: {}", ex.getMessage());
        }
        return false;
    }

    @Override
    public AIHealthStatus checkHealth() {
        long start = System.currentTimeMillis();
        try {
            String url = getCleanBaseUrl() + "/api/tags";
            ResponseEntity<String> response = restTemplate.getForEntity(url, String.class);
            long latency = System.currentTimeMillis() - start;

            if (!response.getStatusCode().is2xxSuccessful() || response.getBody() == null) {
                return AIHealthStatus.down(getProviderName(), properties.getModel(), "HTTP " + response.getStatusCode().value());
            }

            JsonNode root = objectMapper.readTree(response.getBody());
            JsonNode models = root.path("models");
            boolean available = false;
            if (models.isArray()) {
                for (JsonNode m : models) {
                    String name = m.path("name").asText();
                    if (name.equalsIgnoreCase(properties.getModel()) || name.startsWith(properties.getModel() + ":")) {
                        available = true;
                        break;
                    }
                }
            }

            // Check if model is currently loaded in memory via /api/ps
            boolean loaded = false;
            try {
                ResponseEntity<String> psResp = restTemplate.getForEntity(getCleanBaseUrl() + "/api/ps", String.class);
                if (psResp.getStatusCode().is2xxSuccessful() && psResp.getBody() != null) {
                    JsonNode psRoot = objectMapper.readTree(psResp.getBody());
                    JsonNode running = psRoot.path("models");
                    if (running.isArray()) {
                        for (JsonNode r : running) {
                            String name = r.path("name").asText();
                            if (name.equalsIgnoreCase(properties.getModel()) || name.startsWith(properties.getModel() + ":")) {
                                loaded = true;
                                break;
                            }
                        }
                    }
                }
            } catch (Exception ignored) {
                // /api/ps is an optional readiness check
            }

            return AIHealthStatus.up(getProviderName(), properties.getModel(), available, loaded, latency);
        } catch (Exception ex) {
            return AIHealthStatus.down(getProviderName(), properties.getModel(), ex.getMessage());
        }
    }

    @Override
    public String getProviderName() {
        return "OLLAMA";
    }

    /**
     * Strips <think>...</think> reasoning blocks cleanly from Qwen3 responses.
     */
    public static String stripThinking(String text) {
        if (text == null) return null;
        return text.replaceAll("(?s)<think>.*?</think>", "").trim();
    }

    private String getCleanBaseUrl() {
        return properties.getBaseUrl().replaceAll("/+$", "");
    }
}
