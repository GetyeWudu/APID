package com.boa.apid.mentoring.document.service;

import com.boa.apid.common.exception.BusinessException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestClientResponseException;

import java.net.http.HttpClient;
import java.time.Duration;

@Service
public class PaddleOcrClient {

    private static final Logger log = LoggerFactory.getLogger(PaddleOcrClient.class);

    private final RestClient restClient;
    private final String ocrUrl;

    public PaddleOcrClient(@Value("${mentoring.ocr.url}") String ocrUrl) {
        HttpClient httpClient = HttpClient.newBuilder()
                .version(HttpClient.Version.HTTP_1_1)
                .connectTimeout(Duration.ofSeconds(5))
                .build();
        JdkClientHttpRequestFactory requestFactory = new JdkClientHttpRequestFactory(httpClient);
        requestFactory.setReadTimeout(Duration.ofSeconds(120));
        this.restClient = RestClient.builder().requestFactory(requestFactory).build();
        this.ocrUrl = ocrUrl;
    }

    public String extractText(byte[] image, String contentType) {
        try {
            OcrResponse response = restClient.post()
                    .uri(ocrUrl)
                    .contentType(MediaType.parseMediaType(contentType))
                    .body(image)
                    .retrieve()
                    .body(OcrResponse.class);
            if (response == null || response.text() == null) {
                throw new BusinessException(
                        "MENTOR_DOCUMENT_OCR_INVALID_RESPONSE",
                        "The document OCR service returned an invalid response.",
                        HttpStatus.BAD_GATEWAY
                );
            }
            return response.text();
        } catch (RestClientResponseException error) {
            log.warn("PaddleOCR rejected image: status={}, bytes={}, detail={}",
                    error.getStatusCode().value(), image.length, error.getResponseBodyAsString());
            if (error.getStatusCode().value() == HttpStatus.PAYLOAD_TOO_LARGE.value()) {
                throw new BusinessException(
                        "MENTOR_DOCUMENT_IMAGE_TOO_LARGE",
                        "The image exceeds PaddleOCR processing limits.",
                        HttpStatus.PAYLOAD_TOO_LARGE
                );
            }
            if (error.getStatusCode().is4xxClientError()) {
                throw new BusinessException(
                        "MENTOR_DOCUMENT_OCR_INVALID_IMAGE",
                        "The image could not be processed for text extraction.",
                        HttpStatus.UNPROCESSABLE_ENTITY
                );
            }
            throw unavailable();
        } catch (RestClientException error) {
            throw unavailable();
        }
    }

    private BusinessException unavailable() {
        return new BusinessException(
                "MENTOR_DOCUMENT_OCR_UNAVAILABLE",
                "Image text extraction is unavailable. Please try again later.",
                HttpStatus.BAD_GATEWAY
        );
    }

    private record OcrResponse(String text) {
    }
}
