package com.boa.apid.mentoring.collaboration.service;

import com.boa.apid.common.exception.BusinessException;
import com.boa.apid.common.exception.ResourceNotFoundException;
import com.boa.apid.common.storage.FilePurpose;
import com.boa.apid.common.storage.FileStorageService;
import com.boa.apid.common.storage.StoredFile;
import com.boa.apid.common.storage.StoredFileRepository;
import com.boa.apid.core.audit.service.AuditService;
import com.boa.apid.core.auth.security.ApidUserPrincipal;
import com.boa.apid.core.authorization.entity.User;
import com.boa.apid.core.authorization.repository.UserRepository;
import com.boa.apid.core.notifications.entity.NotificationModule;
import com.boa.apid.core.notifications.service.NotificationService;
import com.boa.apid.core.organization.entity.Employee;
import com.boa.apid.core.organization.repository.EmployeeRepository;
import com.boa.apid.mentoring.collaboration.dto.MentoringFeedbackRequest;
import com.boa.apid.mentoring.collaboration.dto.MentoringFeedbackDto;
import com.boa.apid.mentoring.collaboration.dto.MentoringProgressNoteDto;
import com.boa.apid.mentoring.collaboration.dto.MentoringResourceDto;
import com.boa.apid.mentoring.collaboration.dto.MentoringRelationshipStatusRequest;
import com.boa.apid.mentoring.collaboration.entity.MentoringProgressNote;
import com.boa.apid.mentoring.collaboration.entity.MentoringRelationshipFeedback;
import com.boa.apid.mentoring.collaboration.entity.MentoringRelationshipFeedbackId;
import com.boa.apid.mentoring.collaboration.entity.MentoringResource;
import com.boa.apid.mentoring.collaboration.entity.MentoringResourceType;
import com.boa.apid.mentoring.collaboration.repository.MentoringProgressNoteRepository;
import com.boa.apid.mentoring.collaboration.repository.MentoringRelationshipFeedbackRepository;
import com.boa.apid.mentoring.collaboration.repository.MentoringResourceRepository;
import com.boa.apid.mentoring.pairing.entity.MentoringRelationship;
import com.boa.apid.mentoring.pairing.entity.MentoringRelationshipMember;
import com.boa.apid.mentoring.pairing.entity.MentoringRelationshipMemberStatus;
import com.boa.apid.mentoring.pairing.entity.MentoringRelationshipStatus;
import com.boa.apid.mentoring.pairing.repository.MentoringRelationshipMemberRepository;
import com.boa.apid.mentoring.pairing.repository.MentoringRelationshipRepository;
import com.boa.apid.mentoring.pairing.entity.MentoringSessionStatus;
import com.boa.apid.mentoring.pairing.repository.MentoringSessionRepository;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.net.URI;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
public class MentoringRelationshipManagementService {

    private final MentoringRelationshipRepository relationshipRepository;
    private final MentoringRelationshipMemberRepository memberRepository;
    private final MentoringSessionRepository sessionRepository;
    private final MentoringResourceRepository resourceRepository;
    private final MentoringProgressNoteRepository progressNoteRepository;
    private final MentoringRelationshipFeedbackRepository feedbackRepository;
    private final EmployeeRepository employeeRepository;
    private final UserRepository userRepository;
    private final StoredFileRepository storedFileRepository;
    private final FileStorageService fileStorageService;
    private final NotificationService notificationService;
    private final AuditService auditService;

    public MentoringRelationshipManagementService(
            MentoringRelationshipRepository relationshipRepository,
            MentoringRelationshipMemberRepository memberRepository,
            MentoringSessionRepository sessionRepository,
            MentoringResourceRepository resourceRepository,
            MentoringProgressNoteRepository progressNoteRepository,
            MentoringRelationshipFeedbackRepository feedbackRepository,
            EmployeeRepository employeeRepository,
            UserRepository userRepository,
            StoredFileRepository storedFileRepository,
            FileStorageService fileStorageService,
            NotificationService notificationService,
            AuditService auditService
    ) {
        this.relationshipRepository = relationshipRepository;
        this.memberRepository = memberRepository;
        this.sessionRepository = sessionRepository;
        this.resourceRepository = resourceRepository;
        this.progressNoteRepository = progressNoteRepository;
        this.feedbackRepository = feedbackRepository;
        this.employeeRepository = employeeRepository;
        this.userRepository = userRepository;
        this.storedFileRepository = storedFileRepository;
        this.fileStorageService = fileStorageService;
        this.notificationService = notificationService;
        this.auditService = auditService;
    }

    @Transactional(readOnly = true)
    public List<MentoringResourceDto> listResources(Long relationshipId, ApidUserPrincipal actor) {
        requireRelationshipAccess(relationshipId, actor.getUserId());
        return resourceRepository.findByRelationship_IdOrderByCreatedAtDesc(relationshipId).stream()
                .map(MentoringResourceDto::from)
                .toList();
    }

    @Transactional
    public MentoringResourceDto addResource(
            Long relationshipId,
            String title,
            String externalUrl,
            MultipartFile file,
            ApidUserPrincipal actor
    ) {
        MentoringRelationship relationship = requireRelationshipAccess(relationshipId, actor.getUserId());
        ensureWritableParticipant(relationship, actor.getUserId());
        String normalizedTitle = title == null ? "" : title.trim();
        String normalizedUrl = normalizeOptional(externalUrl);
        boolean hasFile = file != null && !file.isEmpty();
        if (normalizedTitle.isBlank() || normalizedTitle.length() > 180) {
            throw new BusinessException("INVALID_MENTORING_RESOURCE_TITLE", "Enter a resource title (180 characters or fewer).");
        }
        if (hasFile == (normalizedUrl != null)) {
            throw new BusinessException(
                    "MENTORING_RESOURCE_TARGET_REQUIRED",
                    "Provide either a file or a link, but not both."
            );
        }

        MentoringResource resource = new MentoringResource();
        resource.setRelationship(relationship);
        resource.setTitle(normalizedTitle);
        resource.setUploadedBy(requireUser(actor.getUserId()));
        if (hasFile) {
            var stored = fileStorageService.store(file, FilePurpose.MENTORING_RESOURCE, actor);
            StoredFile storedFile = storedFileRepository.findByIdAndDeletedFalse(stored.id())
                    .orElseThrow(() -> new ResourceNotFoundException("Stored mentoring resource not found"));
            if (storedFile.getPurpose() != FilePurpose.MENTORING_RESOURCE
                    || !actor.getUserId().equals(storedFile.getUploadedByUserId())) {
                throw new AccessDeniedException("The resource file is not owned by the current user.");
            }
            resource.setResourceType(MentoringResourceType.FILE);
            resource.setFile(storedFile);
        } else {
            resource.setResourceType(MentoringResourceType.LINK);
            resource.setExternalUrl(normalizeHttpUrl(normalizedUrl));
        }
        return MentoringResourceDto.from(resourceRepository.save(resource));
    }

    @Transactional(readOnly = true)
    public FileStorageService.LoadedFile downloadResource(
            Long relationshipId,
            Long resourceId,
            ApidUserPrincipal actor
    ) {
        MentoringResource resource = resourceRepository.findDetailedById(resourceId)
                .orElseThrow(() -> new ResourceNotFoundException("Mentoring resource not found"));
        if (!resource.getRelationship().getId().equals(relationshipId)) {
            throw new ResourceNotFoundException("Mentoring resource not found");
        }
        requireRelationshipAccess(resource.getRelationship().getId(), actor.getUserId());
        if (resource.getResourceType() != MentoringResourceType.FILE || resource.getFile() == null) {
            throw new ResourceNotFoundException("Mentoring resource file not found");
        }
        return fileStorageService.loadForAuthorizedModule(resource.getFile().getId());
    }

    @Transactional(readOnly = true)
    public List<MentoringProgressNoteDto> listProgressNotes(Long relationshipId, ApidUserPrincipal actor) {
        requireRelationshipAccess(relationshipId, actor.getUserId());
        return progressNoteRepository.findByRelationship_IdOrderByCreatedAtDesc(relationshipId).stream()
                .map(MentoringProgressNoteDto::from)
                .toList();
    }

    @Transactional
    public MentoringProgressNoteDto addProgressNote(
            Long relationshipId,
            String note,
            ApidUserPrincipal actor
    ) {
        MentoringRelationship relationship = requireRelationshipAccess(relationshipId, actor.getUserId());
        ensureWritableParticipant(relationship, actor.getUserId());
        String normalized = normalizeOptional(note);
        if (normalized == null || normalized.length() > 2000) {
            throw new BusinessException(
                    "INVALID_MENTORING_PROGRESS_NOTE",
                    "Enter a progress note of 2000 characters or fewer."
            );
        }
        MentoringProgressNote progressNote = new MentoringProgressNote();
        progressNote.setRelationship(relationship);
        progressNote.setAuthor(requireUser(actor.getUserId()));
        progressNote.setNote(normalized);
        return MentoringProgressNoteDto.from(progressNoteRepository.save(progressNote));
    }

    @Transactional
    public void submitFeedback(
            Long relationshipId,
            MentoringFeedbackRequest request,
            ApidUserPrincipal actor
    ) {
        MentoringRelationship relationship = requireRelationshipAccess(relationshipId, actor.getUserId());
        if (relationship.getStatus() != MentoringRelationshipStatus.COMPLETED) {
            throw new BusinessException(
                    "MENTORING_FEEDBACK_REQUIRES_COMPLETION",
                    "Feedback can be submitted after the relationship is completed.",
                    HttpStatus.CONFLICT
            );
        }
        if (relationship.getMentorUser().getId().equals(actor.getUserId())) {
            throw new AccessDeniedException("Only a trainee can submit relationship feedback.");
        }
        Employee employee = employeeRepository.findDetailedByUserId(actor.getUserId())
                .orElseThrow(() -> new ResourceNotFoundException("Trainee employee profile not found"));
        if (!memberRepository.existsByRelationship_IdAndTraineeUser_Id(relationshipId, actor.getUserId())) {
            throw new AccessDeniedException("Only a trainee in this relationship can submit feedback.");
        }
        if (feedbackRepository.existsByRelationship_IdAndTraineeEmployee_Id(relationshipId, employee.getId())) {
            throw new BusinessException(
                    "MENTORING_FEEDBACK_ALREADY_SUBMITTED",
                    "Feedback has already been submitted for this relationship.",
                    HttpStatus.CONFLICT
            );
        }
        MentoringRelationshipFeedback feedback = new MentoringRelationshipFeedback();
        feedback.setId(new MentoringRelationshipFeedbackId(relationshipId, employee.getId()));
        feedback.setRelationship(relationship);
        feedback.setTraineeEmployee(employee);
        feedback.setRating(request.rating());
        feedback.setFeedback(normalizeOptional(request.feedback()));
        feedbackRepository.save(feedback);
    }

    @Transactional(readOnly = true)
    public MentoringFeedbackDto getMyFeedback(Long relationshipId, ApidUserPrincipal actor) {
        requireRelationshipAccess(relationshipId, actor.getUserId());
        Employee employee = employeeRepository.findDetailedByUserId(actor.getUserId())
                .orElseThrow(() -> new ResourceNotFoundException("Trainee employee profile not found"));
        return feedbackRepository.findById(new MentoringRelationshipFeedbackId(relationshipId, employee.getId()))
                .map(MentoringFeedbackDto::from)
                .orElse(null);
    }

    @Transactional
    public void changeRelationshipStatus(
            Long relationshipId,
            MentoringRelationshipStatusRequest request,
            ApidUserPrincipal actor
    ) {
        MentoringRelationship relationship = relationshipRepository.findDetailedById(relationshipId)
                .orElseThrow(() -> new ResourceNotFoundException("Mentoring relationship not found"));
        boolean isMentor = relationship.getMentorUser().getId().equals(actor.getUserId());
        boolean hasHrAuthority = actor.getPermissions().contains("TRAINER_STATUS_MANAGE")
                || actor.getPermissions().contains("MENTORING_MATCH_MANAGE");
        if (!isMentor && !hasHrAuthority) {
            throw new AccessDeniedException("Only the relationship mentor or authorized HR can close it.");
        }
        MentoringRelationshipStatus nextStatus = request.status();
        if (nextStatus != MentoringRelationshipStatus.COMPLETED
                && nextStatus != MentoringRelationshipStatus.CANCELLED) {
            throw new BusinessException("INVALID_MENTORING_RELATIONSHIP_STATUS", "Choose completed or cancelled.");
        }
        if (relationship.getStatus() != MentoringRelationshipStatus.ACTIVE
                && relationship.getStatus() != MentoringRelationshipStatus.PAUSED) {
            throw new BusinessException(
                    "MENTORING_RELATIONSHIP_ALREADY_CLOSED",
                    "Only an active or paused mentoring relationship can be closed.",
                    HttpStatus.CONFLICT
            );
        }
        if (nextStatus == MentoringRelationshipStatus.COMPLETED
                && sessionRepository.countByRelationship_IdAndStatus(
                        relationshipId,
                        MentoringSessionStatus.CONFIRMED
                ) > 0) {
            throw new BusinessException(
                    "MENTORING_SESSIONS_UNFINISHED",
                    "Submit a report for every confirmed session before completing the relationship.",
                    HttpStatus.CONFLICT
            );
        }
        String reason = request.reason().trim();
        relationship.setStatus(nextStatus);
        relationship.setEndedAt(Instant.now());
        relationshipRepository.save(relationship);

        List<MentoringRelationshipMember> members =
                memberRepository.findByRelationship_IdOrderByJoinedAtAsc(relationshipId);
        MentoringRelationshipMemberStatus memberStatus = nextStatus == MentoringRelationshipStatus.COMPLETED
                ? MentoringRelationshipMemberStatus.COMPLETED
                : MentoringRelationshipMemberStatus.CANCELLED;
        members.stream()
                .filter(member -> member.getStatus() == MentoringRelationshipMemberStatus.ACTIVE)
                .forEach(member -> {
                    member.setStatus(memberStatus);
                    member.setEndedAt(Instant.now());
                    notify(member.getTraineeUser().getId(),
                            "MENTORING_RELATIONSHIP_" + nextStatus.name(),
                            "Mentoring relationship " + nextStatus.name().toLowerCase(),
                            "Your mentoring relationship has been " + nextStatus.name().toLowerCase() + ".",
                            "/mentoring/pairing/" + relationshipId);
                });
        memberRepository.saveAll(members);
        notify(relationship.getMentorUser().getId(),
                "MENTORING_RELATIONSHIP_" + nextStatus.name(),
                "Mentoring relationship " + nextStatus.name().toLowerCase(),
                "The mentoring relationship has been " + nextStatus.name().toLowerCase() + ".",
                "/mentoring/pairing/" + relationshipId);
        Map<String, Object> details = new LinkedHashMap<>();
        details.put("newStatus", nextStatus.name());
        details.put("reason", reason);
        auditService.record(new AuditService.AuditCommand(
                null,
                actor.getUserId(),
                actor.getUsername(),
                relationship.getMentorUser().getId(),
                "MENTORING",
                "MENTORING_RELATIONSHIP_" + nextStatus.name(),
                "SUCCESS",
                null,
                "MENTORING_RELATIONSHIP",
                String.valueOf(relationshipId),
                details,
                null,
                null
        ));
    }

    private MentoringRelationship requireRelationshipAccess(Long relationshipId, Long userId) {
        MentoringRelationship relationship = relationshipRepository.findDetailedById(relationshipId)
                .orElseThrow(() -> new ResourceNotFoundException("Mentoring relationship not found"));
        boolean isMentor = relationship.getMentorUser().getId().equals(userId);
        boolean isTrainee = memberRepository.existsByRelationship_IdAndTraineeUser_Id(relationshipId, userId);
        if (!isMentor && !isTrainee) {
            throw new AccessDeniedException("You are not a participant in this mentoring relationship.");
        }
        return relationship;
    }

    private void ensureWritableParticipant(MentoringRelationship relationship, Long userId) {
        if (relationship.getStatus() != MentoringRelationshipStatus.ACTIVE) {
            throw new BusinessException(
                    "MENTORING_RELATIONSHIP_READ_ONLY",
                    "Resources and progress notes can only be added to active relationships.",
                    HttpStatus.CONFLICT
            );
        }
        boolean isMentor = relationship.getMentorUser().getId().equals(userId);
        boolean activeTrainee = memberRepository.existsByRelationship_IdAndTraineeUser_IdAndStatus(
                relationship.getId(), userId, MentoringRelationshipMemberStatus.ACTIVE);
        if (!isMentor && !activeTrainee) {
            throw new AccessDeniedException("Only active relationship participants can update mentoring records.");
        }
    }

    private User requireUser(Long userId) {
        return userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User account not found"));
    }

    private String normalizeHttpUrl(String value) {
        try {
            URI uri = URI.create(value);
            if (uri.getHost() == null
                    || (!"https".equalsIgnoreCase(uri.getScheme()) && !"http".equalsIgnoreCase(uri.getScheme()))) {
                throw new IllegalArgumentException();
            }
        } catch (IllegalArgumentException exception) {
            throw new BusinessException("INVALID_MENTORING_RESOURCE_URL", "Enter a valid HTTP or HTTPS resource link.");
        }
        return value;
    }

    private String normalizeOptional(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    private void notify(Long userId, String event, String title, String message, String deepLink) {
        notificationService.notify(userId, NotificationModule.MENTORING, event, title, message, deepLink);
    }
}
