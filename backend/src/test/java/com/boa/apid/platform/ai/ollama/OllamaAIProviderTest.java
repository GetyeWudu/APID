package com.boa.apid.platform.ai.ollama;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class OllamaAIProviderTest {

    @Test
    @DisplayName("stripThinking cleanly removes <think>...</think> reasoning blocks from Qwen3 output")
    void testStripThinking() {
        String raw = "<think>\nLet me analyze the coaching notes carefully...\nThe coachee completed goal 1.\n</think>\nHere is the executive summary: Goal 1 completed successfully.";
        String cleaned = OllamaAIProvider.stripThinking(raw);

        assertEquals("Here is the executive summary: Goal 1 completed successfully.", cleaned);
        assertFalse(cleaned.contains("<think>"));
        assertFalse(cleaned.contains("Let me analyze"));
    }

    @Test
    @DisplayName("stripThinking handles normal responses without think blocks")
    void testStripThinkingNoTags() {
        String normal = "Action items for next week: 1. Review policy manual.";
        assertEquals(normal, OllamaAIProvider.stripThinking(normal));
    }

    @Test
    @DisplayName("stripThinking handles null safely")
    void testStripThinkingNull() {
        assertNull(OllamaAIProvider.stripThinking(null));
    }
}
