package com.boa.apid.platform.video.livekit;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

@Component
@ConfigurationProperties(prefix = "apid.livekit")
public class LiveKitConfigProperties {

    /**
     * Server-side LiveKit API URL (e.g., http://10.9.36.155:7880).
     * Used by backend services for administrative room operations and health checks.
     */
    private String apiUrl = "http://10.9.36.155:7880";

    /**
     * Client browser WebSocket connection URL (e.g., ws://10.9.36.155:7880 or wss://apid-livekit.home.arpa).
     * Dispatched to frontend clients inside join tokens.
     */
    private String publicUrl = "ws://10.9.36.155:7880";

    /**
     * LiveKit API Key (e.g., APIDLocalKey).
     */
    private String apiKey = "APIDLocalKey";

    /**
     * LiveKit API Secret (configured locally, never committed).
     */
    private String apiSecret = "HErVoKzJMGiiWkzXrZMPaKMGc1IWXISSjuxGI1AJNic=";

    /**
     * Participant token default time-to-live in seconds.
     */
    private long tokenTtlSeconds = 7200;

    public boolean isConfigured() {
        return apiKey != null && !apiKey.isBlank()
                && apiSecret != null && !apiSecret.isBlank()
                && !apiSecret.startsWith("replace-with");
    }

    public String getApiUrl() {
        return apiUrl;
    }

    public void setApiUrl(String apiUrl) {
        this.apiUrl = apiUrl;
    }

    public String getPublicUrl() {
        return publicUrl;
    }

    public void setPublicUrl(String publicUrl) {
        this.publicUrl = publicUrl;
    }

    public String getApiKey() {
        return apiKey;
    }

    public void setApiKey(String apiKey) {
        this.apiKey = apiKey;
    }

    public String getApiSecret() {
        return apiSecret;
    }

    public void setApiSecret(String apiSecret) {
        this.apiSecret = apiSecret;
    }

    public long getTokenTtlSeconds() {
        return tokenTtlSeconds;
    }

    public void setTokenTtlSeconds(long tokenTtlSeconds) {
        this.tokenTtlSeconds = tokenTtlSeconds;
    }
}
