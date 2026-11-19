package com.boa.apid.mentoring.ai.document.service;

import com.boa.apid.common.exception.BusinessException;
import com.boa.apid.mentoring.ai.client.MentoringAiClient;
import com.boa.apid.mentoring.application.dto.MentorApplicationDocumentSummaryDto;
import com.boa.apid.mentoring.application.service.MentorApplicationDocumentService;
import com.boa.apid.mentoring.application.service.MentorApplicationDocumentService.ApplicationDocumentText;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

@Service
public class MentorApplicationDocumentSummaryService {

    private static final int MAX_SUMMARY_CHARS = 6000;

    private final MentorApplicationDocumentService documentService;
    private final MentoringAiClient ollamaClient;
    private final ObjectMapper objectMapper;

    public MentorApplicationDocumentSummaryService(
            MentorApplicationDocumentService documentService,
            MentoringAiClient ollamaClient,
            ObjectMapper objectMapper
    ) {
        this.documentService = documentService;
        this.ollamaClient = ollamaClient;
        this.objectMapper = objectMapper;
    }

    public MentorApplicationDocumentSummaryDto summarize(Long applicationId, Long fileId) {
        ApplicationDocumentText document = documentService.extractText(applicationId, fileId);
        if (document.text().isBlank()) {
            throw new BusinessException(
                    "MENTOR_DOCUMENT_TEXT_UNAVAILABLE",
                    "No readable text was found in this document.",
                    HttpStatus.UNPROCESSABLE_ENTITY
            );
        }

        SummaryModel modelResponse;
        try {
            modelResponse = objectMapper.readValue(
                    ollamaClient.summarizeDocument(document.text()),
                    SummaryModel.class
            );
        } catch (JsonProcessingException error) {
            throw invalidResponse();
        }
        if (modelResponse == null || modelResponse.summary() == null
                || modelResponse.summary().isBlank()
                || modelResponse.summary().length() > MAX_SUMMARY_CHARS) {
            throw invalidResponse();
        }
        return new MentorApplicationDocumentSummaryDto(
                applicationId,
                document.fileId(),
                document.fileName(),
                modelResponse.summary().trim(),
                document.truncated()
        );
    }

    private BusinessException invalidResponse() {
        return new BusinessException(
                "MENTOR_DOCUMENT_SUMMARY_INVALID_RESPONSE",
                "The document summary service returned an invalid response. Please try again.",
                HttpStatus.BAD_GATEWAY
        );
    }

    public record SummaryModel(String summary) {
    }
}
