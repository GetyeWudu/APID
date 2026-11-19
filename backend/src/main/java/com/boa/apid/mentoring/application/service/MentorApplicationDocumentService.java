package com.boa.apid.mentoring.application.service;

import com.boa.apid.common.exception.ResourceNotFoundException;
import com.boa.apid.common.storage.StoredFile;
import com.boa.apid.mentoring.application.entity.MentorApplication;
import com.boa.apid.mentoring.application.repository.MentorApplicationRepository;
import com.boa.apid.mentoring.document.service.MentoringDocumentTextExtractor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Objects;

@Service
public class MentorApplicationDocumentService {

    private static final int MAX_SUMMARY_DOCUMENT_CHARS = 20_000;

    private final MentorApplicationRepository applicationRepository;
    private final MentoringDocumentTextExtractor textExtractor;

    public MentorApplicationDocumentService(
            MentorApplicationRepository applicationRepository,
            MentoringDocumentTextExtractor textExtractor
    ) {
        this.applicationRepository = applicationRepository;
        this.textExtractor = textExtractor;
    }

    @Transactional(readOnly = true)
    public ApplicationDocumentText extractText(Long applicationId, Long fileId) {
        MentorApplication application = applicationRepository.findById(applicationId)
                .orElseThrow(() -> new ResourceNotFoundException("Mentor application not found"));
        StoredFile document = application.getSupportingEvidence().stream()
                .filter(file -> Objects.equals(file.getId(), fileId))
                .findFirst()
                .orElseGet(() -> application.getProofDocument() != null
                        && Objects.equals(application.getProofDocument().getId(), fileId)
                        ? application.getProofDocument()
                        : null);
        if (document == null) {
            throw new ResourceNotFoundException("Application document not found");
        }

        MentoringDocumentTextExtractor.ExtractedDocumentText extracted =
                textExtractor.extract(fileId, document.getOriginalFilename(), MAX_SUMMARY_DOCUMENT_CHARS);
        return new ApplicationDocumentText(
                document.getId(),
                document.getOriginalFilename(),
                extracted.text(),
                extracted.truncated()
        );
    }

    public record ApplicationDocumentText(
            Long fileId,
            String fileName,
            String text,
            boolean truncated
    ) {
    }
}
