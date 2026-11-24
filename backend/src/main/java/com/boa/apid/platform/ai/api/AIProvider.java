package com.boa.apid.platform.ai.api;

import java.util.List;

public interface AIProvider {

    AIResponse generate(String prompt, AIRequestOptions options);

    default void generateStream(String prompt, AIRequestOptions options, java.util.function.Consumer<String> chunkConsumer) {
        AIResponse resp = generate(prompt, options);
        if (resp != null && resp.success() && resp.content() != null) {
            chunkConsumer.accept(resp.content());
        }
    }

    AIChatResponse chat(List<AIChatMessage> messages, AIRequestOptions options);

    boolean isModelAvailable(String modelName);

    AIHealthStatus checkHealth();

    String getProviderName();
}
