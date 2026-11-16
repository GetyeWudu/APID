package com.boa.apid.mentoring.collaboration.dto;

import com.boa.apid.mentoring.collaboration.entity.MentoringResource;
import com.boa.apid.mentoring.collaboration.entity.MentoringResourceType;

import java.time.Instant;

public record MentoringResourceDto(
        Long id,
        Long relationshipId,
        String title,
        MentoringResourceType resourceType,
        Long fileId,
        String fileName,
        String externalUrl,
        String uploadedByName,
        Instant createdAt
) {
    public static MentoringResourceDto from(MentoringResource resource) {
        return new MentoringResourceDto(
                resource.getId(),
                resource.getRelationship().getId(),
                resource.getTitle(),
                resource.getResourceType(),
                resource.getFile() == null ? null : resource.getFile().getId(),
                resource.getFile() == null ? null : resource.getFile().getOriginalFilename(),
                resource.getExternalUrl(),
                resource.getUploadedBy().getUsername(),
                resource.getCreatedAt()
        );
    }
}
