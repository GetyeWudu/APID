package com.boa.apid.common.storage;

import java.time.Instant;

public record StoredFileDto(
        Long id,
        String originalFilename,
        String contentType,
        long sizeBytes,
        String sha256Hash,
        String module,
        FilePurpose purpose,
        Long uploadedByUserId,
        Instant createdAt
) {}

