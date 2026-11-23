package com.boa.apid.platform.ai.api;

public record AIResponse(
        String content,
        String model,
        long durationMs,
        boolean success,
        String errorMessage
) {
    public static AIResponse ok(String content, String model, long durationMs) {
        return new AIResponse(content, model, durationMs, true, null);
    }

    public static AIResponse error(String errorMessage, String model) {
        return new AIResponse(null, model, 0, false, errorMessage);
    }
}
