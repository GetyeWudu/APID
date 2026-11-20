package com.boa.apid.mentoring.collaboration.controller;

import com.boa.apid.common.response.ApiResponse;
import com.boa.apid.common.storage.FileStorageService;
import com.boa.apid.core.auth.security.ApidUserPrincipal;
import com.boa.apid.mentoring.collaboration.dto.MentoringFeedbackRequest;
import com.boa.apid.mentoring.collaboration.dto.MentoringFeedbackDto;
import com.boa.apid.mentoring.collaboration.dto.MentoringProgressNoteDto;
import com.boa.apid.mentoring.collaboration.dto.MentoringResourceDto;
import com.boa.apid.mentoring.collaboration.dto.MentoringRelationshipStatusRequest;
import com.boa.apid.mentoring.collaboration.service.MentoringRelationshipManagementService;
import jakarta.validation.Valid;
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
import java.util.List;

@RestController
@RequestMapping("/api/v1/mentoring/pairing/relationships/{relationshipId}")
@PreAuthorize("isAuthenticated() and !principal.mustChangePassword and hasAnyAuthority('EMPLOYEE_PORTAL_ACCESS', 'TRAINER_STATUS_MANAGE', 'MENTORING_MATCH_MANAGE')")
public class MentoringRelationshipManagementController {

    private final MentoringRelationshipManagementService relationshipManagementService;

    public MentoringRelationshipManagementController(
            MentoringRelationshipManagementService relationshipManagementService
    ) {
        this.relationshipManagementService = relationshipManagementService;
    }

    @GetMapping("/resources")
    public ApiResponse<List<MentoringResourceDto>> listResources(
            @PathVariable Long relationshipId,
            @AuthenticationPrincipal ApidUserPrincipal actor
    ) {
        return ApiResponse.ok(relationshipManagementService.listResources(relationshipId, actor));
    }

    @PostMapping(value = "/resources", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ApiResponse<MentoringResourceDto> addResource(
            @PathVariable Long relationshipId,
            @RequestParam String title,
            @RequestParam(required = false) String externalUrl,
            @RequestParam(required = false) MultipartFile file,
            @AuthenticationPrincipal ApidUserPrincipal actor
    ) {
        return ApiResponse.ok(
                "Mentoring resource shared",
                relationshipManagementService.addResource(relationshipId, title, externalUrl, file, actor)
        );
    }

    @GetMapping("/resources/{resourceId}/file")
    public ResponseEntity<Resource> downloadResource(
            @PathVariable Long relationshipId,
            @PathVariable Long resourceId,
            @AuthenticationPrincipal ApidUserPrincipal actor
    ) {
        FileStorageService.LoadedFile loaded =
                relationshipManagementService.downloadResource(relationshipId, resourceId, actor);
        return ResponseEntity.ok()
                .contentType(MediaType.APPLICATION_OCTET_STREAM)
                .header(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition.attachment()
                        .filename(loaded.metadata().originalFilename(), StandardCharsets.UTF_8)
                        .build()
                        .toString())
                .body(loaded.resource());
    }

    @GetMapping("/sessions/{sessionId}/resources")
    public ApiResponse<List<MentoringResourceDto>> listSessionResources(
            @PathVariable Long relationshipId,
            @PathVariable Long sessionId,
            @AuthenticationPrincipal ApidUserPrincipal actor
    ) {
        return ApiResponse.ok(
                relationshipManagementService.listSessionResources(relationshipId, sessionId, actor)
        );
    }

    @PostMapping(value = "/sessions/{sessionId}/resources", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ApiResponse<MentoringResourceDto> addSessionResource(
            @PathVariable Long relationshipId,
            @PathVariable Long sessionId,
            @RequestParam String title,
            @RequestParam(required = false) String externalUrl,
            @RequestParam(required = false) MultipartFile file,
            @AuthenticationPrincipal ApidUserPrincipal actor
    ) {
        return ApiResponse.ok(
                "Session resource shared",
                relationshipManagementService.addSessionResource(
                        relationshipId, sessionId, title, externalUrl, file, actor
                )
        );
    }

    @GetMapping("/sessions/{sessionId}/resources/{resourceId}/file")
    public ResponseEntity<Resource> downloadSessionResource(
            @PathVariable Long relationshipId,
            @PathVariable Long sessionId,
            @PathVariable Long resourceId,
            @AuthenticationPrincipal ApidUserPrincipal actor
    ) {
        FileStorageService.LoadedFile loaded =
                relationshipManagementService.downloadSessionResource(
                        relationshipId, sessionId, resourceId, actor
                );
        return ResponseEntity.ok()
                .contentType(MediaType.APPLICATION_OCTET_STREAM)
                .header(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition.attachment()
                        .filename(loaded.metadata().originalFilename(), StandardCharsets.UTF_8)
                        .build()
                        .toString())
                .body(loaded.resource());
    }

    @GetMapping("/progress-notes")
    public ApiResponse<List<MentoringProgressNoteDto>> listProgressNotes(
            @PathVariable Long relationshipId,
            @AuthenticationPrincipal ApidUserPrincipal actor
    ) {
        return ApiResponse.ok(relationshipManagementService.listProgressNotes(relationshipId, actor));
    }

    @PostMapping("/progress-notes")
    public ApiResponse<MentoringProgressNoteDto> addProgressNote(
            @PathVariable Long relationshipId,
            @RequestBody @Valid ProgressNoteRequest request,
            @AuthenticationPrincipal ApidUserPrincipal actor
    ) {
        return ApiResponse.ok(
                "Progress note recorded",
                relationshipManagementService.addProgressNote(relationshipId, request.note(), actor)
        );
    }

    @PostMapping("/feedback")
    public ApiResponse<Void> submitFeedback(
            @PathVariable Long relationshipId,
            @RequestBody @Valid MentoringFeedbackRequest request,
            @AuthenticationPrincipal ApidUserPrincipal actor
    ) {
        relationshipManagementService.submitFeedback(relationshipId, request, actor);
        return ApiResponse.ok("Mentoring feedback submitted", null);
    }

    @GetMapping("/feedback/mine")
    public ApiResponse<MentoringFeedbackDto> getMyFeedback(
            @PathVariable Long relationshipId,
            @AuthenticationPrincipal ApidUserPrincipal actor
    ) {
        return ApiResponse.ok(relationshipManagementService.getMyFeedback(relationshipId, actor));
    }

    @PatchMapping("/status")
    public ApiResponse<Void> changeRelationshipStatus(
            @PathVariable Long relationshipId,
            @RequestBody @Valid MentoringRelationshipStatusRequest request,
            @AuthenticationPrincipal ApidUserPrincipal actor
    ) {
        relationshipManagementService.changeRelationshipStatus(relationshipId, request, actor);
        return ApiResponse.ok("Mentoring relationship closed", null);
    }

    public record ProgressNoteRequest(
            @jakarta.validation.constraints.NotNull
            @jakarta.validation.constraints.Size(min = 1, max = 2000)
            String note
    ) {
    }
}
