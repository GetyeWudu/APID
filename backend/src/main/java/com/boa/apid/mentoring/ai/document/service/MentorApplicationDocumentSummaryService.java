package com.boa.apid.mentoring.ai.document.service;

import com.boa.apid.common.exception.BusinessException;
import com.boa.apid.mentoring.application.dto.MentorApplicationDocumentSummaryDto;
import com.boa.apid.mentoring.application.service.MentorApplicationDocumentService;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

@Service
public class MentorApplicationDocumentSummaryService {

    private final MentorApplicationDocumentService documentService;
    private final MentorApplicationDocumentSummaryCache summaryCache;
    private final ObjectMapper objectMapper;

    public MentorApplicationDocumentSummaryService(
            MentorApplicationDocumentService documentService,
            MentorApplicationDocumentSummaryCache summaryCache,
            ObjectMapper objectMapper
    ) {
        this.documentService = documentService;
        this.summaryCache = summaryCache;
        this.objectMapper = objectMapper;
    }

    public MentorApplicationDocumentSummaryDto summarize(Long applicationId, Long fileId) {
        documentService.ensureEvidenceBelongsToApplication(applicationId, fileId);
        try {
            return objectMapper.readValue(
                    summaryCache.summarizeAsJson(applicationId, fileId),
                    MentorApplicationDocumentSummaryDto.class
            );
        } catch (JsonProcessingException error) {
            throw invalidCacheEntry();
        }
    }

    private BusinessException invalidCacheEntry() {
        return new BusinessException(
                "MENTOR_DOCUMENT_SUMMARY_CACHE_INVALID",
                "The cached document summary is invalid. Please try again.",
                HttpStatus.BAD_GATEWAY
        );
    }
}
