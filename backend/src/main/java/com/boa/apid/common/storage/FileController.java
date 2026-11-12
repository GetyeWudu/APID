package com.boa.apid.common.storage;

import com.boa.apid.common.response.ApiResponse;
import com.boa.apid.core.auth.security.ApidUserPrincipal;
import org.springframework.core.io.Resource;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.nio.charset.StandardCharsets;

@RestController
@RequestMapping("/api/v1/core/files")
public class FileController {

    private final FileStorageService fileStorageService;

    public FileController(FileStorageService fileStorageService) {
        this.fileStorageService = fileStorageService;
    }

    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize("hasAnyAuthority('EMPLOYEE_PORTAL_ACCESS', 'PMS_REPORT_UPLOAD', 'HIERARCHY_MANAGE', 'USER_MANAGE')")
    public ApiResponse<StoredFileDto> upload(
            @RequestParam("file") MultipartFile file,
            @RequestParam("purpose") FilePurpose purpose,
            @AuthenticationPrincipal ApidUserPrincipal actor
    ) {
        return ApiResponse.ok("File uploaded successfully", fileStorageService.store(file, purpose, actor));
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAnyAuthority('EMPLOYEE_PORTAL_ACCESS', 'PMS_REPORT_UPLOAD', 'TRAINER_APPLICATION_REVIEW', 'USER_MANAGE')")
    public ApiResponse<StoredFileDto> metadata(@PathVariable Long id) {
        return ApiResponse.ok(fileStorageService.getMetadata(id));
    }

    @GetMapping("/{id}/download")
    @PreAuthorize("hasAnyAuthority('EMPLOYEE_PORTAL_ACCESS', 'PMS_REPORT_UPLOAD', 'TRAINER_APPLICATION_REVIEW', 'HIERARCHY_MANAGE', 'USER_MANAGE')")
    public ResponseEntity<Resource> download(
            @PathVariable Long id,
            @AuthenticationPrincipal ApidUserPrincipal actor
    ) {
        FileStorageService.LoadedFile loaded = fileStorageService.loadForDownload(id, actor);
        StoredFileDto meta = loaded.metadata();

        ContentDisposition disposition = ContentDisposition.attachment()
                .filename(meta.originalFilename(), StandardCharsets.UTF_8)
                .build();

        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, disposition.toString())
                .header("X-Content-Type-Options", "nosniff")
                .contentType(MediaType.parseMediaType(meta.contentType()))
                .contentLength(meta.sizeBytes())
                .body(loaded.resource());
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAnyAuthority('EMPLOYEE_PORTAL_ACCESS', 'PMS_REPORT_UPLOAD', 'HIERARCHY_MANAGE', 'USER_MANAGE')")
    public ApiResponse<Void> delete(
            @PathVariable Long id,
            @AuthenticationPrincipal ApidUserPrincipal actor
    ) {
        fileStorageService.softDelete(id, actor);
        return ApiResponse.ok("File deleted", null);
    }
}

