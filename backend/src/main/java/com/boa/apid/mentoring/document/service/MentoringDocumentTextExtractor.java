package com.boa.apid.mentoring.document.service;

import com.boa.apid.common.exception.BusinessException;
import com.boa.apid.common.storage.FileStorageService;
import com.lowagie.text.ExceptionConverter;
import com.lowagie.text.pdf.PdfReader;
import com.lowagie.text.pdf.parser.PdfTextExtractor;
import org.apache.poi.hwpf.HWPFDocument;
import org.apache.poi.hwpf.extractor.WordExtractor;
import org.apache.poi.ooxml.POIXMLException;
import org.apache.poi.xwpf.extractor.XWPFWordExtractor;
import org.apache.poi.xwpf.usermodel.XWPFDocument;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.io.InputStream;
import java.util.Locale;
import java.util.Set;

@Service
public class MentoringDocumentTextExtractor {

    private static final Logger log = LoggerFactory.getLogger(MentoringDocumentTextExtractor.class);
    private static final int MAX_IMAGE_BYTES = 10 * 1024 * 1024;
    private static final Set<String> SUPPORTED_EXTENSIONS = Set.of("pdf", "doc", "docx", "png", "jpg", "jpeg");

    private final FileStorageService fileStorageService;
    private final PaddleOcrClient paddleOcrClient;

    public MentoringDocumentTextExtractor(
            FileStorageService fileStorageService,
            PaddleOcrClient paddleOcrClient
    ) {
        this.fileStorageService = fileStorageService;
        this.paddleOcrClient = paddleOcrClient;
    }

    public boolean supports(String filename) {
        return SUPPORTED_EXTENSIONS.contains(extension(filename));
    }

    public ExtractedDocumentText extract(Long fileId, String filename, int maxCharacters) {
        if (!supports(filename)) {
            throw new BusinessException(
                    "MENTOR_DOCUMENT_UNSUPPORTED_FORMAT",
                    "AI summaries are supported for PDF, DOC, DOCX, PNG, JPG, and JPEG files.",
                    HttpStatus.UNSUPPORTED_MEDIA_TYPE
            );
        }
        if (maxCharacters < 1) {
            throw new IllegalArgumentException("The document text limit must be positive.");
        }

        Resource resource = fileStorageService.loadForAuthorizedModule(fileId).resource();
        try (InputStream input = resource.getInputStream()) {
            String extension = extension(filename);
            return switch (extension) {
                case "pdf" -> extractPdf(input, maxCharacters);
                case "doc" -> limit(extractDoc(input), maxCharacters);
                case "docx" -> limit(extractDocx(input), maxCharacters);
                case "png", "jpg", "jpeg" -> extractImage(input, extension, maxCharacters);
                default -> throw new IllegalStateException("Unsupported document extension.");
            };
        } catch (IOException | ExceptionConverter | POIXMLException | IllegalArgumentException error) {
            log.warn("Could not extract mentoring document id={} ({})",
                    fileId, error.getClass().getSimpleName());
            throw new BusinessException(
                    "MENTOR_DOCUMENT_EXTRACTION_FAILED",
                    "The document text could not be extracted.",
                    HttpStatus.UNPROCESSABLE_ENTITY
            );
        }
    }

    private ExtractedDocumentText extractPdf(InputStream input, int maxCharacters) throws IOException {
        PdfReader reader = new PdfReader(input);
        try {
            PdfTextExtractor extractor = new PdfTextExtractor(reader);
            StringBuilder text = new StringBuilder();
            int pageCount = reader.getNumberOfPages();
            for (int page = 1; page <= pageCount; page++) {
                String pageText = extractor.getTextFromPage(page) + "\n";
                int remaining = maxCharacters - text.length();
                if (pageText.length() > remaining) {
                    text.append(pageText, 0, remaining);
                    return new ExtractedDocumentText(text.toString(), true);
                }
                text.append(pageText);
                if (text.length() == maxCharacters && page < pageCount) {
                    return new ExtractedDocumentText(text.toString(), true);
                }
            }
            return new ExtractedDocumentText(text.toString(), false);
        } finally {
            reader.close();
        }
    }

    private String extractDoc(InputStream input) throws IOException {
        try (HWPFDocument document = new HWPFDocument(input);
             WordExtractor extractor = new WordExtractor(document)) {
            return extractor.getText();
        }
    }

    private String extractDocx(InputStream input) throws IOException {
        try (XWPFDocument document = new XWPFDocument(input);
             XWPFWordExtractor extractor = new XWPFWordExtractor(document)) {
            return extractor.getText();
        }
    }

    private ExtractedDocumentText extractImage(InputStream input, String extension, int maxCharacters)
            throws IOException {
        byte[] image = input.readNBytes(MAX_IMAGE_BYTES + 1);
        if (image.length > MAX_IMAGE_BYTES) {
            throw new BusinessException(
                    "MENTOR_DOCUMENT_IMAGE_TOO_LARGE",
                    "Image documents must be 10 MB or smaller for text extraction.",
                    HttpStatus.PAYLOAD_TOO_LARGE
            );
        }
        String contentType = extension.equals("png") ? "image/png" : "image/jpeg";
        return limit(paddleOcrClient.extractText(image, contentType), maxCharacters);
    }

    private ExtractedDocumentText limit(String text, int maxCharacters) {
        if (text.length() <= maxCharacters) {
            return new ExtractedDocumentText(text, false);
        }
        return new ExtractedDocumentText(text.substring(0, maxCharacters), true);
    }

    private String extension(String filename) {
        if (filename == null) return "";
        int dot = filename.lastIndexOf('.');
        return dot < 0 ? "" : filename.substring(dot + 1).toLowerCase(Locale.ROOT);
    }

    public record ExtractedDocumentText(String text, boolean truncated) {
    }
}
