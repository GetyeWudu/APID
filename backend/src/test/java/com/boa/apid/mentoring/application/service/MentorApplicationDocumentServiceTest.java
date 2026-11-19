package com.boa.apid.mentoring.application.service;

import com.boa.apid.common.exception.ResourceNotFoundException;
import com.boa.apid.common.storage.StoredFile;
import com.boa.apid.mentoring.application.entity.MentorApplication;
import com.boa.apid.mentoring.application.repository.MentorApplicationRepository;
import com.boa.apid.mentoring.document.service.MentoringDocumentTextExtractor;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class MentorApplicationDocumentServiceTest {

    @Mock
    private MentorApplicationRepository applicationRepository;

    @Mock
    private MentoringDocumentTextExtractor textExtractor;

    private MentorApplicationDocumentService service;

    @BeforeEach
    void setUp() {
        service = new MentorApplicationDocumentService(applicationRepository, textExtractor);
    }

    @Test
    void extractsOnlyFilesAttachedToTheSelectedApplication() {
        MentorApplication application = new MentorApplication();
        application.setSupportingEvidence(Set.of(storedFile(61L, "resume.pdf")));
        when(applicationRepository.findById(23L)).thenReturn(Optional.of(application));
        when(textExtractor.extract(61L, "resume.pdf", 20_000))
                .thenReturn(new MentoringDocumentTextExtractor.ExtractedDocumentText("document text", false));

        var result = service.extractText(23L, 61L);

        assertEquals("resume.pdf", result.fileName());
        assertEquals("document text", result.text());
        assertEquals(61L, result.fileId());
    }

    @Test
    void rejectsFilesNotAttachedToTheSelectedApplication() {
        MentorApplication application = new MentorApplication();
        application.setSupportingEvidence(Set.of(storedFile(61L, "resume.pdf")));
        when(applicationRepository.findById(23L)).thenReturn(Optional.of(application));

        assertThrows(ResourceNotFoundException.class, () -> service.extractText(23L, 99L));
        verify(textExtractor, never()).extract(anyLong(), anyString(), anyInt());
    }

    @Test
    void acceptsTheApplicationsProofDocument() {
        MentorApplication application = new MentorApplication();
        application.setProofDocument(storedFile(63L, "proof.docx"));
        when(applicationRepository.findById(23L)).thenReturn(Optional.of(application));
        when(textExtractor.extract(63L, "proof.docx", 20_000))
                .thenReturn(new MentoringDocumentTextExtractor.ExtractedDocumentText("proof text", false));

        var result = service.extractText(23L, 63L);

        assertEquals(63L, result.fileId());
        assertEquals("proof text", result.text());
    }

    private StoredFile storedFile(Long fileId, String fileName) {
        StoredFile file = new StoredFile();
        file.setId(fileId);
        file.setOriginalFilename(fileName);
        return file;
    }
}
