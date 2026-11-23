package com.boa.apid.platform.ai.api;

public record AIChatResponse(
        AIChatMessage message,
        String model,
        long durationMs,
        boolean success,
        String errorMessage
) {
    public static AIChatResponse ok(AIChatMessage message, String model, long durationMs) {
        return new AIChatResponse(message, model, durationMs, true, null);
    }

    public static AIChatResponse error(String errorMessage, String model) {
        return new AIChatResponse(null, model, 0, false, errorMessage);
    }
}
