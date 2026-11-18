package com.boa.apid.platform.ai.api;

public record AIRequestOptions(
        Double temperature,
        Integer maxTokens,
        String format, // e.g. "json" for structured outputs
        boolean stream
) {
    public static AIRequestOptions defaults() {
        return new AIRequestOptions(0.7, null, null, false);
    }

    public static AIRequestOptions json() {
        return new AIRequestOptions(0.2, null, "json", false);
    }
}
