package com.boa.apid.common.storage;

import com.boa.apid.core.auth.security.ApidUserPrincipal;
import org.springframework.core.io.Resource;
import org.springframework.web.multipart.MultipartFile;

/**
 * Storage abstraction backed by ./uploads in Phase 1 and swappable to MinIO/S3 without module changes.
 */
public interface FileStorageService {

    StoredFileDto store(MultipartFile file, FilePurpose purpose, ApidUserPrincipal actor);

    StoredFileDto getMetadata(Long fileId);

    LoadedFile loadForDownload(Long fileId, ApidUserPrincipal actor);

    /**
     * Loads a file after the caller module (e.g., Coaching/Mentoring) has verified domain participation.
     */
    LoadedFile loadForAuthorizedModule(Long fileId);

    void softDelete(Long fileId, ApidUserPrincipal actor);

    record LoadedFile(StoredFileDto metadata, Resource resource) {}
}

