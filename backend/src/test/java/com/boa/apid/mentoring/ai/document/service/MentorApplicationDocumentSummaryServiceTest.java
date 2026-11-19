package com.boa.apid.mentoring.ai.document.service;

import com.boa.apid.common.exception.BusinessException;
import com.boa.apid.mentoring.ai.client.MentoringAiClient;
import com.boa.apid.mentoring.application.service.MentorApplicationDocumentService;
import com.boa.apid.mentoring.application.service.MentorApplicationDocumentService.ApplicationDocumentText;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class MentorApplicationDocumentSummaryServiceTest {

    @Mock
    private MentorApplicationDocumentService documentService;

    @Mock
    private MentoringAiClient ollamaClient;

    private MentorApplicationDocumentSummaryService service;

    @BeforeEach
    void setUp() {
        service = new MentorApplicationDocumentSummaryService(
                documentService,
                ollamaClient,
                new ObjectMapper()
        );
    }

    @Test
    void returnsTheValidatedSummaryAndTruncationState() {
        when(documentService.extractText(23L, 61L)).thenReturn(
                new ApplicationDocumentText(61L, "resume.pdf", "document text", true)
        );
        when(ollamaClient.summarizeDocument(anyString())).thenReturn(
                "{\"summary\":\"A concise summary of the document.\"}"
        );

        var result = service.summarize(23L, 61L);

        assertEquals(23L, result.applicationId());
        assertEquals(61L, result.fileId());
        assertEquals("A concise summary of the document.", result.summary());
        assertTrue(result.sourceTruncated());
    }

    @Test
    void doesNotCallTheModelWhenNoTextCanBeExtracted() {
        when(documentService.extractText(23L, 61L)).thenReturn(
                new ApplicationDocumentText(61L, "scan.pdf", " \n ", false)
        );

        assertThrows(BusinessException.class, () -> service.summarize(23L, 61L));
    }

    @Test
    void rejectsBlankModelSummaries() {
        when(documentService.extractText(23L, 61L)).thenReturn(
                new ApplicationDocumentText(61L, "resume.pdf", "document text", false)
        );
        when(ollamaClient.summarizeDocument(anyString())).thenReturn("{\"summary\":\"  \"}");

        assertThrows(BusinessException.class, () -> service.summarize(23L, 61L));
    }
}
