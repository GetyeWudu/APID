package com.boa.apid.common.storage;

import com.boa.apid.common.exception.BusinessException;
import com.boa.apid.common.exception.ResourceNotFoundException;
import com.boa.apid.core.audit.service.AuditService;
import com.boa.apid.core.auth.security.ApidUserPrincipal;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.Resource;
import org.springframework.core.io.UrlResource;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.io.InputStream;
import java.net.MalformedURLException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.security.DigestInputStream;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

@Service
public class LocalFileStorageService implements FileStorageService {

    private final Path rootLocation;
    private final StoredFileRepository storedFileRepository;
    private final AuditService auditService;

    public LocalFileStorageService(
            @Value("${apid.storage.path:../uploads}") String storagePath,
            StoredFileRepository storedFileRepository,
            AuditService auditService
    ) {
        this.rootLocation = Paths.get(storagePath).toAbsolutePath().normalize();
        this.storedFileRepository = storedFileRepository;
        this.auditService = auditService;
    }

    @Override
    @Transactional
    public StoredFileDto store(MultipartFile file, FilePurpose purpose, ApidUserPrincipal actor) {
        if (file == null || file.isEmpty()) {
            throw new BusinessException("EMPTY_FILE", "Uploaded file must not be empty", HttpStatus.BAD_REQUEST);
        }
        if (file.getSize() > purpose.getMaxSizeBytes()) {
            throw new BusinessException("FILE_TOO_LARGE",
                    "File exceeds maximum allowed size for " + purpose.name(), HttpStatus.BAD_REQUEST);
        }

        String originalFilename = sanitizeFilename(file.getOriginalFilename());
        String extension = extractExtension(originalFilename);
        if (!purpose.getAllowedExtensions().contains(extension)) {
            throw new BusinessException("INVALID_FILE_TYPE",
                    "File extension '." + extension + "' is not allowed for " + purpose.name(),
                    HttpStatus.BAD_REQUEST);
        }

        verifyMagicBytes(file, extension);

        String storageKey = purpose.getFolder() + "/" + UUID.randomUUID() + "." + extension;
        Path targetPath = resolveSafePath(storageKey);

        String sha256Hex;
        try {
            Files.createDirectories(targetPath.getParent());
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            try (InputStream in = new DigestInputStream(file.getInputStream(), digest)) {
                Files.copy(in, targetPath, StandardCopyOption.REPLACE_EXISTING);
            }
            sha256Hex = HexFormat.of().formatHex(digest.digest());
        } catch (IOException | NoSuchAlgorithmException ex) {
            throw new BusinessException("FILE_STORAGE_ERROR", "Failed to store uploaded file",
                    HttpStatus.INTERNAL_SERVER_ERROR);
        }

        StoredFile entity = new StoredFile();
        entity.setStorageKey(storageKey);
        entity.setOriginalFilename(originalFilename);
        entity.setContentType(resolveSafeContentType(file.getContentType(), extension));
        entity.setSizeBytes(file.getSize());
        entity.setSha256Hash(sha256Hex);
        entity.setModule(purpose.getModule());
        entity.setPurpose(purpose);
        entity.setUploadedByUserId(actor.getUserId());

        StoredFile saved = storedFileRepository.save(entity);

        auditService.record(new AuditService.AuditCommand(
                null, actor.getUserId(), actor.getUsername(), null,
                "FILE", "FILE_UPLOADED", "SUCCESS", null,
                "STORED_FILE", String.valueOf(saved.getId()),
                Map.of("purpose", purpose.name(), "sizeBytes", saved.getSizeBytes(), "ext", extension),
                null, null
        ));

        return toDto(saved);
    }

    @Override
    @Transactional(readOnly = true)
    public StoredFileDto getMetadata(Long fileId) {
        return toDto(findActiveFile(fileId));
    }

    @Override
    @Transactional(readOnly = true)
    public LoadedFile loadForDownload(Long fileId, ApidUserPrincipal actor) {
        StoredFile entity = findActiveFile(fileId);
        if (!canDownloadDirect(entity, actor)) {
            throw new AccessDeniedException("You are not authorized to download this file");
        }
        return new LoadedFile(toDto(entity), loadPhysicalResource(entity));
    }

    @Override
    @Transactional(readOnly = true)
    public LoadedFile loadForAuthorizedModule(Long fileId) {
        StoredFile entity = findActiveFile(fileId);
        return new LoadedFile(toDto(entity), loadPhysicalResource(entity));
    }

    @Override
    @Transactional
    public void softDelete(Long fileId, ApidUserPrincipal actor) {
        StoredFile entity = findActiveFile(fileId);
        boolean isOwner = entity.getUploadedByUserId().equals(actor.getUserId());
        boolean isAdmin = actor.getRoles().contains("Super Admin")
                || actor.getPermissions().contains("USER_MANAGE");
        if (!isOwner && !isAdmin) {
            throw new AccessDeniedException("Only the uploader or an administrator can delete this file");
        }
        entity.setDeleted(true);
        storedFileRepository.save(entity);

        auditService.record(new AuditService.AuditCommand(
                null, actor.getUserId(), actor.getUsername(), null,
                "FILE", "FILE_DELETED", "SUCCESS", null,
                "STORED_FILE", String.valueOf(entity.getId()),
                Map.of("purpose", entity.getPurpose().name()),
                null, null
        ));
    }

    private StoredFile findActiveFile(Long fileId) {
        return storedFileRepository.findByIdAndDeletedFalse(fileId)
                .orElseThrow(() -> new ResourceNotFoundException("File not found"));
    }

    private Resource loadPhysicalResource(StoredFile entity) {
        try {
            Path resolved = resolveSafePath(entity.getStorageKey());
            Resource resource = new UrlResource(resolved.toUri());
            if (!resource.exists() || !resource.isReadable()) {
                throw new ResourceNotFoundException("Stored file contents not found");
            }
            return resource;
        } catch (MalformedURLException ex) {
            throw new ResourceNotFoundException("Invalid stored file path");
        }
    }

    private Path resolveSafePath(String storageKey) {
        Path resolved = rootLocation.resolve(storageKey).normalize();
        if (!resolved.startsWith(rootLocation)) {
            throw new BusinessException("INVALID_STORAGE_PATH", "Invalid storage path", HttpStatus.BAD_REQUEST);
        }
        return resolved;
    }

    private boolean canDownloadDirect(StoredFile entity, ApidUserPrincipal actor) {
        if (entity.getUploadedByUserId().equals(actor.getUserId())) {
            return true;
        }
        if (actor.getRoles().contains("Super Admin")) {
            return true;
        }
        Set<String> perms = actor.getPermissions();
        return switch (entity.getPurpose()) {
            case TRAINER_CERT -> perms.contains("TRAINER_APPLICATION_REVIEW")
                    || perms.contains("TRAINER_STATUS_MANAGE")
                    || perms.contains("MENTORING_REPORT_VIEW_ALL");
            case MENTORING_RESOURCE -> perms.contains("MENTORING_MATCH_MANAGE")
                    || perms.contains("MENTORING_REPORT_VIEW_ALL");
            case PMS_REPORT, SKILL_DEV_DOC -> perms.contains("PMS_REPORT_UPLOAD")
                    || perms.contains("COACHING_ASSIGNMENT_VIEW_ALL")
                    || perms.contains("COACHING_REQUEST_APPROVE")
                    || perms.contains("COACHING_REPORT_VIEW_ALL");
            case COACHING_RESOURCE -> perms.contains("COACHING_ASSIGNMENT_VIEW_ALL")
                    || perms.contains("COACHING_REPORT_VIEW_ALL");
            case HIERARCHY_CSV -> perms.contains("HIERARCHY_MANAGE");
            case CHAT_ATTACHMENT -> false; // Must be served through Coaching/Mentoring participant-checked endpoints
        };
    }

    private String sanitizeFilename(String raw) {
        if (raw == null || raw.isBlank()) {
            return "upload";
        }
        String base = Paths.get(raw).getFileName().toString().trim();
        String cleaned = base.replaceAll("[\\r\\n\\\\/:\"*?<>|]", "_");
        return cleaned.length() > 255 ? cleaned.substring(cleaned.length() - 255) : cleaned;
    }

    private String extractExtension(String filename) {
        int idx = filename.lastIndexOf('.');
        if (idx < 0 || idx == filename.length() - 1) {
            return "";
        }
        return filename.substring(idx + 1).toLowerCase(Locale.ROOT);
    }

    private void verifyMagicBytes(MultipartFile file, String extension) {
        byte[] header = new byte[16];
        int read;
        try (InputStream in = file.getInputStream()) {
            read = in.read(header);
        } catch (IOException ex) {
            throw new BusinessException("UNREADABLE_FILE", "Could not inspect uploaded file", HttpStatus.BAD_REQUEST);
        }
        if (read <= 0) {
            throw new BusinessException("EMPTY_FILE", "Uploaded file has no readable bytes", HttpStatus.BAD_REQUEST);
        }

        boolean valid = switch (extension) {
            case "pdf" -> read >= 4 && header[0] == 0x25 && header[1] == 0x50
                    && header[2] == 0x44 && header[3] == 0x46; // %PDF
            case "png" -> read >= 4 && (header[0] & 0xFF) == 0x89 && header[1] == 0x50
                    && header[2] == 0x4E && header[3] == 0x47;
            case "jpg", "jpeg" -> read >= 3 && (header[0] & 0xFF) == 0xFF
                    && (header[1] & 0xFF) == 0xD8 && (header[2] & 0xFF) == 0xFF;
            case "xlsx", "docx", "pptx" -> read >= 4 && header[0] == 0x50 && header[1] == 0x4B
                    && header[2] == 0x03 && header[3] == 0x04; // OOXML ZIP PK\x03\x04
            case "csv" -> hasNoNullBytes(header, read);
            default -> true;
        };

        if (!valid) {
            throw new BusinessException("FILE_SIGNATURE_MISMATCH",
                    "File contents do not match declared '." + extension + "' format",
                    HttpStatus.BAD_REQUEST);
        }
    }

    private boolean hasNoNullBytes(byte[] bytes, int len) {
        for (int i = 0; i < len; i++) {
            if (bytes[i] == 0) {
                return false;
            }
        }
        return true;
    }

    private String resolveSafeContentType(String declared, String ext) {
        return switch (ext) {
            case "pdf" -> "application/pdf";
            case "png" -> "image/png";
            case "jpg", "jpeg" -> "image/jpeg";
            case "xlsx" -> "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
            case "docx" -> "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
            case "pptx" -> "application/vnd.openxmlformats-officedocument.presentationml.presentation";
            case "csv" -> "text/csv";
            default -> (declared != null && !declared.isBlank()) ? declared : "application/octet-stream";
        };
    }

    private StoredFileDto toDto(StoredFile f) {
        return new StoredFileDto(
                f.getId(),
                f.getOriginalFilename(),
                f.getContentType(),
                f.getSizeBytes(),
                f.getSha256Hash(),
                f.getModule(),
                f.getPurpose(),
                f.getUploadedByUserId(),
                f.getCreatedAt()
        );
    }
}

