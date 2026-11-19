package com.boa.apid.mentoring.trainer.service;

import com.boa.apid.mentoring.trainer.dto.TrainerDirectoryDto;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Component
public class TrainerDirectoryProfileDetailsMapper {

    private static final Logger log = LoggerFactory.getLogger(TrainerDirectoryProfileDetailsMapper.class);

    private final ObjectMapper objectMapper;

    public TrainerDirectoryProfileDetailsMapper(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    public ProfileDetails map(String applicationNote, Long mentorUserId) {
        Map<String, String> noteFields = parseNote(applicationNote);
        return new ProfileDetails(
                parseEducation(noteFields.get("Educational background"), mentorUserId),
                parseCertificates(noteFields.get("Professional certificates"), mentorUserId)
        );
    }

    private List<TrainerDirectoryDto.EducationProfile> parseEducation(String value, Long mentorUserId) {
        if (value == null || value.isBlank()) return List.of();
        try {
            List<TrainerDirectoryDto.EducationProfile> records = objectMapper.readValue(
                    value,
                    new TypeReference<List<TrainerDirectoryDto.EducationProfile>>() {
                    }
            );
            return records == null ? List.of() : records.stream()
                    .filter(record -> record != null && (
                            hasText(record.educationLevel())
                                    || hasText(record.fieldOfStudy())
                                    || hasText(record.institution())
                    ))
                    .toList();
        } catch (JsonProcessingException error) {
            log.warn("Could not parse education details for mentor user id={}", mentorUserId);
            return List.of();
        }
    }

    private List<TrainerDirectoryDto.ProfessionalCertificate> parseCertificates(String value, Long mentorUserId) {
        if (value == null || value.isBlank()) return List.of();
        try {
            List<TrainerDirectoryDto.ProfessionalCertificate> records = objectMapper.readValue(
                    value,
                    new TypeReference<List<TrainerDirectoryDto.ProfessionalCertificate>>() {
                    }
            );
            return records == null ? List.of() : records.stream()
                    .filter(record -> record != null && hasText(record.title()))
                    .toList();
        } catch (JsonProcessingException error) {
            log.warn("Could not parse professional certificates for mentor user id={}", mentorUserId);
            return List.of();
        }
    }

    private Map<String, String> parseNote(String note) {
        Map<String, String> fields = new LinkedHashMap<>();
        if (note == null || note.isBlank()) return fields;
        for (String line : note.lines().toList()) {
            int separator = line.indexOf(':');
            if (separator > 0) {
                fields.put(line.substring(0, separator).trim(), line.substring(separator + 1).trim());
            }
        }
        return fields;
    }

    private boolean hasText(String value) {
        return value != null && !value.isBlank();
    }

    public record ProfileDetails(
            List<TrainerDirectoryDto.EducationProfile> education,
            List<TrainerDirectoryDto.ProfessionalCertificate> professionalCertificates
    ) {
    }
}
