package com.boa.apid.platform.ai.api;

public record AIChatMessage(
        String role,
        String content
) {
    public static AIChatMessage system(String content) {
        return new AIChatMessage("system", content);
    }

    public static AIChatMessage user(String content) {
        return new AIChatMessage("user", content);
    }

    public static AIChatMessage assistant(String content) {
        return new AIChatMessage("assistant", content);
    }
}
