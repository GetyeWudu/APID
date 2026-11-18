package com.boa.apid.platform.ai.ollama;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

@Component
@ConfigurationProperties(prefix = "apid.ai.ollama")
public class OllamaConfigProperties {

    /**
     * Local Ollama API base URL (e.g. http://10.9.36.155:11434).
     */
    private String baseUrl = "http://10.9.36.155:11434";

    /**
     * Target language model name (e.g. qwen3:8b).
     */
    private String model = "qwen3:8b";

    /**
     * Inference timeout in seconds.
     */
    private int timeoutSeconds = 120;

    public String getBaseUrl() {
        return baseUrl;
    }

    public void setBaseUrl(String baseUrl) {
        this.baseUrl = baseUrl;
    }

    public String getModel() {
        return model;
    }

    public void setModel(String model) {
        this.model = model;
    }

    public int getTimeoutSeconds() {
        return timeoutSeconds;
    }

    public void setTimeoutSeconds(int timeoutSeconds) {
        this.timeoutSeconds = timeoutSeconds;
    }
}
