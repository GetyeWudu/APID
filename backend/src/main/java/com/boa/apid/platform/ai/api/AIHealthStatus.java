package com.boa.apid.platform.ai.api;

public record AIHealthStatus(
        boolean healthy,
        String provider,
        String targetModel,
        boolean modelAvailable,
        boolean modelLoaded,
        long latencyMs,
        String message
) {
    public static AIHealthStatus up(String provider, String model, boolean modelAvailable, boolean modelLoaded, long latencyMs) {
        return new AIHealthStatus(true, provider, model, modelAvailable, modelLoaded, latencyMs, "AI service is reachable and ready.");
    }

    public static AIHealthStatus down(String provider, String model, String message) {
        return new AIHealthStatus(false, provider, model, false, false, 0, message);
    }
}
