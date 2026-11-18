package com.boa.apid.platform.ai.api;

import java.util.List;

public interface AIProvider {

    AIResponse generate(String prompt, AIRequestOptions options);

    AIChatResponse chat(List<AIChatMessage> messages, AIRequestOptions options);

    boolean isModelAvailable(String modelName);

    AIHealthStatus checkHealth();

    String getProviderName();
}
