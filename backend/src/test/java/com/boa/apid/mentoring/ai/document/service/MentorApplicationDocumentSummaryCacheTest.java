package com.boa.apid.mentoring.ai.document.service;

import com.boa.apid.mentoring.ai.client.MentoringAiClient;
import com.boa.apid.mentoring.application.service.MentorApplicationDocumentService;
import com.boa.apid.mentoring.application.service.MentorApplicationDocumentService.ApplicationDocumentText;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.cache.CacheManager;
import org.springframework.cache.annotation.EnableCaching;
import org.springframework.cache.concurrent.ConcurrentMapCacheManager;
import org.springframework.context.annotation.AnnotationConfigApplicationContext;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class MentorApplicationDocumentSummaryCacheTest {

    @Test
    void reusesCachedSummaryForTheSameApplicationDocument() {
        try (AnnotationConfigApplicationContext context =
                     new AnnotationConfigApplicationContext(CacheTestConfiguration.class)) {
            MentorApplicationDocumentService documentService =
                    context.getBean(MentorApplicationDocumentService.class);
            MentoringAiClient aiClient = context.getBean(MentoringAiClient.class);
            MentorApplicationDocumentSummaryCache summaryCache =
                    context.getBean(MentorApplicationDocumentSummaryCache.class);
            when(documentService.extractText(23L, 61L)).thenReturn(
                    new ApplicationDocumentText(61L, "resume.pdf", "document text", false)
            );
            when(aiClient.summarizeDocument(anyString(), anyInt()))
                    .thenReturn("{\"summary\":\"A concise summary.\"}");

            String firstResult = summaryCache.summarizeAsJson(23L, 61L);
            String cachedResult = summaryCache.summarizeAsJson(23L, 61L);

            assertEquals(firstResult, cachedResult);
            verify(documentService, times(1)).extractText(23L, 61L);
            verify(aiClient, times(1)).summarizeDocument("document text", 6000);
        }
    }

    @Configuration
    @EnableCaching
    static class CacheTestConfiguration {

        @Bean
        MentorApplicationDocumentService documentService() {
            return mock(MentorApplicationDocumentService.class);
        }

        @Bean
        MentoringAiClient aiClient() {
            return mock(MentoringAiClient.class);
        }

        @Bean
        ObjectMapper objectMapper() {
            return new ObjectMapper();
        }

        @Bean
        CacheManager cacheManager() {
            return new ConcurrentMapCacheManager("mentor_application_document_summaries");
        }

        @Bean
        MentorApplicationDocumentSummaryCache summaryCache(
                MentorApplicationDocumentService documentService,
                MentoringAiClient aiClient,
                ObjectMapper objectMapper
        ) {
            return new MentorApplicationDocumentSummaryCache(documentService, aiClient, objectMapper);
        }
    }
}
