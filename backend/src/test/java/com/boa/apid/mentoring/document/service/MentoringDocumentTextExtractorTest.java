package com.boa.apid.mentoring.document.service;

import com.boa.apid.common.storage.FileStorageService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.springframework.core.io.ByteArrayResource;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Arrays;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class MentoringDocumentTextExtractorTest {

    @Mock
    private FileStorageService fileStorageService;

    @Mock
    private PaddleOcrClient paddleOcrClient;

    private MentoringDocumentTextExtractor extractor;

    @BeforeEach
    void setUp() {
        extractor = new MentoringDocumentTextExtractor(fileStorageService, paddleOcrClient);
    }

    @Test
    void recognizesCommonImageDocuments() {
        assertTrue(extractor.supports("scan.png"));
        assertTrue(extractor.supports("scan.jpg"));
        assertTrue(extractor.supports("scan.jpeg"));
    }

    @Test
    void sendsImageBytesToPaddleOcrAndLimitsExtractedText() {
        byte[] image = {1, 2, 3};
        when(fileStorageService.loadForAuthorizedModule(61L))
                .thenReturn(new FileStorageService.LoadedFile(null, new ByteArrayResource(image)));
        when(paddleOcrClient.extractText(any(byte[].class), eq("image/png")))
                .thenReturn("Recognized image text");

        var result = extractor.extract(61L, "scan.PNG", 10);

        assertEquals("Recognized", result.text());
        assertTrue(result.truncated());
        verify(paddleOcrClient).extractText(
                argThat(actual -> Arrays.equals(image, actual)),
                eq("image/png")
        );
    }
}
