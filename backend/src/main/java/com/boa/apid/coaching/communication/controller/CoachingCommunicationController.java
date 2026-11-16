package com.boa.apid.coaching.communication.controller;

import com.boa.apid.common.response.ApiResponse;
import com.boa.apid.common.storage.FilePurpose;
import com.boa.apid.common.storage.FileStorageService;
import com.boa.apid.common.storage.StoredFileDto;
import com.boa.apid.coaching.communication.dto.*;
import com.boa.apid.coaching.communication.entity.AttachmentScanStatus;
import com.boa.apid.coaching.communication.entity.CoachingMessage;
import com.boa.apid.coaching.communication.entity.MessageAttachment;
import com.boa.apid.coaching.communication.repository.CoachingMessageRepository;
import com.boa.apid.coaching.communication.repository.MessageAttachmentRepository;
import com.boa.apid.coaching.communication.service.CoachingCommunicationService;
import com.boa.apid.coaching.communication.service.ConversationAccessService;
import com.boa.apid.core.auth.security.ApidUserPrincipal;
import jakarta.validation.Valid;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Objects;

@RestController
@RequestMapping("/api/v1/coaching/conversations")
public class CoachingCommunicationController {

    private final CoachingCommunicationService communicationService;
    private final ConversationAccessService accessService;
    private final FileStorageService fileStorageService;
    private final MessageAttachmentRepository attachmentRepository;
    private final CoachingMessageRepository messageRepository;

    public CoachingCommunicationController(
            CoachingCommunicationService communicationService,
            ConversationAccessService accessService,
            FileStorageService fileStorageService,
            MessageAttachmentRepository attachmentRepository,
            CoachingMessageRepository messageRepository
    ) {
        this.communicationService = communicationService;
        this.accessService = accessService;
        this.fileStorageService = fileStorageService;
        this.attachmentRepository = attachmentRepository;
        this.messageRepository = messageRepository;
    }

    /**
     * List all active conversations for the authenticated user.
     */
    @GetMapping
    public ApiResponse<List<ConversationSummaryDto>> getMyConversations(
            @AuthenticationPrincipal ApidUserPrincipal actor
    ) {
        List<ConversationSummaryDto> conversations = communicationService.getMyConversations(actor.getUserId());
        return ApiResponse.ok(conversations);
    }

    /**
     * Get metadata and participants of a specific conversation.
     */
    @GetMapping("/{id}")
    public ApiResponse<ConversationSummaryDto> getConversation(
            @PathVariable("id") Long conversationId,
            @AuthenticationPrincipal ApidUserPrincipal actor
    ) {
        ConversationSummaryDto conv = communicationService.getConversationDetails(conversationId, actor.getUserId());
        return ApiResponse.ok(conv);
    }

    /**
     * Retrieve messages for a conversation (cursor pagination and incremental sync).
     */
    @GetMapping("/{id}/messages")
    public ApiResponse<List<MessageDto>> getMessages(
            @PathVariable("id") Long conversationId,
            @RequestParam(value = "beforeId", required = false) Long beforeId,
            @RequestParam(value = "afterId", required = false) Long afterId,
            @RequestParam(value = "limit", defaultValue = "50") int limit,
            @AuthenticationPrincipal ApidUserPrincipal actor
    ) {
        List<MessageDto> messages = communicationService.getMessages(
                conversationId, beforeId, afterId, limit, actor.getUserId()
        );
        return ApiResponse.ok(messages);
    }

    /**
     * Send a new message.
     */
    @PostMapping("/{id}/messages")
    public ApiResponse<MessageDto> sendMessage(
            @PathVariable("id") Long conversationId,
            @Valid @RequestBody SendMessageRequest request,
            @AuthenticationPrincipal ApidUserPrincipal actor
    ) {
        MessageDto sent = communicationService.sendMessage(conversationId, request, actor.getUserId());
        return ApiResponse.ok(sent);
    }

    /**
     * Mark conversation as read up to a message ID.
     */
    @PostMapping("/{id}/read")
    public ApiResponse<Void> markRead(
            @PathVariable("id") Long conversationId,
            @Valid @RequestBody MarkReadRequest request,
            @AuthenticationPrincipal ApidUserPrincipal actor
    ) {
        communicationService.markRead(conversationId, request.getLastReadMessageId(), actor.getUserId());
        return ApiResponse.ok("Marked as read", null);
    }

    /**
     * Toggle pinned state of a message.
     */
    @PostMapping("/{id}/messages/{messageId}/pin")
    public ApiResponse<MessageDto> togglePinMessage(
            @PathVariable("id") Long conversationId,
            @PathVariable("messageId") Long messageId,
            @AuthenticationPrincipal ApidUserPrincipal actor
    ) {
        MessageDto updated = communicationService.togglePinMessage(conversationId, messageId, actor.getUserId());
        return ApiResponse.ok(updated);
    }

    /**
     * Resolve or start a private peer-to-peer 1-on-1 thread between two employees in an approved skill cohort.
     */
    @PostMapping("/peer")
    public ApiResponse<ConversationSummaryDto> getOrCreatePeerConversation(
            @Valid @RequestBody CreatePeerConversationRequest request,
            @AuthenticationPrincipal ApidUserPrincipal actor
    ) {
        ConversationSummaryDto conv = communicationService.getOrCreatePeerConversation(
                request.getSkillRequestId(), request.getTargetEmployeeId(), actor.getUserId()
        );
        return ApiResponse.ok(conv);
    }

    /**
     * Upload an attachment for a conversation message.
     */
    @PostMapping("/{id}/attachments")
    public ApiResponse<AttachmentDto> uploadAttachment(
            @PathVariable("id") Long conversationId,
            @RequestParam("file") MultipartFile file,
            @AuthenticationPrincipal ApidUserPrincipal actor
    ) {
        accessService.verifyActiveParticipant(conversationId, actor.getUserId());

        StoredFileDto stored = fileStorageService.store(file, FilePurpose.CHAT_ATTACHMENT, actor);

        MessageAttachment attachment = new MessageAttachment();
        attachment.setMessageId(0L); // Will be linked when the message is submitted
        attachment.setFileName(stored.originalFilename());
        attachment.setStorageKey(stored.id().toString());
        attachment.setMimeType(stored.contentType() != null ? stored.contentType() : "application/octet-stream");
        attachment.setFileSizeBytes(stored.sizeBytes());
        attachment.setScanStatus(AttachmentScanStatus.CLEAN);
        attachment.setUploadedByUserId(actor.getUserId());

        MessageAttachment saved = attachmentRepository.save(attachment);

        AttachmentDto dto = new AttachmentDto();
        dto.setId(saved.getId());
        dto.setMessageId(saved.getMessageId());
        dto.setFileName(saved.getFileName());
        dto.setMimeType(saved.getMimeType());
        dto.setFileSizeBytes(saved.getFileSizeBytes());
        dto.setScanStatus(saved.getScanStatus());
        dto.setCreatedAt(saved.getCreatedAt());
        dto.setDownloadUrl("/api/v1/coaching/conversations/attachments/" + saved.getId());

        return ApiResponse.ok(dto);
    }

    /**
     * Download or stream an attachment with participant authorization check.
     */
    @GetMapping("/attachments/{attachmentId}")
    public ResponseEntity<Resource> downloadAttachment(
            @PathVariable("attachmentId") Long attachmentId,
            @AuthenticationPrincipal ApidUserPrincipal actor
    ) {
        MessageAttachment attachment = attachmentRepository.findById(attachmentId)
                .orElseThrow(() -> new IllegalArgumentException("Attachment not found: " + attachmentId));

        // If attachment is linked to a message, verify participant access
        if (attachment.getMessageId() != null && attachment.getMessageId() > 0) {
            CoachingMessage msg = messageRepository.findById(attachment.getMessageId())
                    .orElseThrow(() -> new IllegalArgumentException("Parent message not found"));
            accessService.verifyParticipantForRead(msg.getConversationId(), actor.getUserId());
        } else {
            // Unlinked draft attachment: only uploader can access
            if (!Objects.equals(attachment.getUploadedByUserId(), actor.getUserId())) {
                throw new AccessDeniedException("Access denied to pending attachment.");
            }
        }

        Long storedFileId = Long.parseLong(attachment.getStorageKey());
        FileStorageService.LoadedFile loaded = fileStorageService.loadForAuthorizedModule(storedFileId);
        Resource resource = loaded.resource();

        String encodedFilename = URLEncoder.encode(attachment.getFileName(), StandardCharsets.UTF_8).replace("+", "%20");
        MediaType mediaType;
        try {
            mediaType = MediaType.parseMediaType(attachment.getMimeType());
        } catch (Exception e) {
            mediaType = MediaType.APPLICATION_OCTET_STREAM;
        }

        return ResponseEntity.ok()
                .contentType(mediaType)
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + encodedFilename + "\"; filename*=UTF-8''" + encodedFilename)
                .body(resource);
    }
}
