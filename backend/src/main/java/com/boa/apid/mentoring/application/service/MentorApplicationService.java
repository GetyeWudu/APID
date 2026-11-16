package com.boa.apid.mentoring.application.service;

import com.boa.apid.common.exception.BusinessException;
import com.boa.apid.common.exception.ResourceNotFoundException;
import com.boa.apid.common.storage.FilePurpose;
import com.boa.apid.common.storage.FileStorageService;
import com.boa.apid.common.storage.StoredFile;
import com.boa.apid.common.storage.StoredFileDto;
import com.boa.apid.common.storage.StoredFileRepository;
import com.boa.apid.core.auth.security.ApidUserPrincipal;
import com.boa.apid.core.audit.service.AuditService;
import com.boa.apid.core.authorization.entity.Role;
import com.boa.apid.core.authorization.entity.User;
import com.boa.apid.core.authorization.entity.UserRole;
import com.boa.apid.core.authorization.entity.UserStatus;
import com.boa.apid.core.authorization.repository.RoleRepository;
import com.boa.apid.core.authorization.repository.UserRepository;
import com.boa.apid.core.authorization.repository.UserRoleRepository;
import com.boa.apid.core.authorization.service.PermissionCacheInvalidationEvent;
import com.boa.apid.core.notifications.entity.NotificationModule;
import com.boa.apid.core.notifications.service.NotificationService;
import com.boa.apid.core.skills.entity.Skill;
import com.boa.apid.core.skills.repository.SkillRepository;
import com.boa.apid.core.skills.service.SkillCacheInvalidationEvent;
import com.boa.apid.mentoring.application.dto.MentorApplicationDto;
import com.boa.apid.mentoring.application.dto.MentorApplicationReviewRequest;
import com.boa.apid.mentoring.application.dto.MentorApplicationSubmittedDto;
import com.boa.apid.mentoring.application.entity.MentorApplication;
import com.boa.apid.mentoring.application.entity.MentorApplicationStatus;
import com.boa.apid.mentoring.application.repository.MentorApplicationRepository;
import com.boa.apid.mentoring.trainer.service.TrainerAuthorizationService;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

@Service
public class MentorApplicationService {

    private final MentorApplicationRepository applicationRepository;
    private final UserRepository userRepository;
    private final SkillRepository skillRepository;
    private final StoredFileRepository storedFileRepository;
    private final FileStorageService fileStorageService;
    private final RoleRepository roleRepository;
    private final UserRoleRepository userRoleRepository;
    private final AuditService auditService;
    private final NotificationService notificationService;
    private final ApplicationEventPublisher eventPublisher;
    private final TrainerAuthorizationService trainerAuthorizationService;

    public MentorApplicationService(
            MentorApplicationRepository applicationRepository,
            UserRepository userRepository,
            SkillRepository skillRepository,
            StoredFileRepository storedFileRepository,
            FileStorageService fileStorageService,
            RoleRepository roleRepository,
            UserRoleRepository userRoleRepository,
            AuditService auditService,
            NotificationService notificationService,
            ApplicationEventPublisher eventPublisher,
            TrainerAuthorizationService trainerAuthorizationService
    ) {
        this.applicationRepository = applicationRepository;
        this.userRepository = userRepository;
        this.skillRepository = skillRepository;
        this.storedFileRepository = storedFileRepository;
        this.fileStorageService = fileStorageService;
        this.roleRepository = roleRepository;
        this.userRoleRepository = userRoleRepository;
        this.auditService = auditService;
        this.notificationService = notificationService;
        this.eventPublisher = eventPublisher;
        this.trainerAuthorizationService = trainerAuthorizationService;
    }

    @Transactional
    public MentorApplicationSubmittedDto submit(
            Long catalogSkillId,
            String customSkill,
            String note,
            MultipartFile proofDocument,
            ApidUserPrincipal actor
    ) {
        return submit(catalogSkillId, customSkill, note, null, null, null, proofDocument, actor);
    }

    @Transactional
    public MentorApplicationSubmittedDto submit(
            Long catalogSkillId,
            String customSkill,
            String note,
            String expertiseSummary,
            String availabilityNotes,
            Integer maxConcurrentTrainees,
            MultipartFile proofDocument,
            ApidUserPrincipal actor
    ) {
        return submit(
                catalogSkillId == null ? List.of() : List.of(catalogSkillId),
                customSkill,
                note,
                expertiseSummary,
                availabilityNotes,
                maxConcurrentTrainees,
                proofDocument == null ? List.of() : List.of(proofDocument),
                actor
        );
    }

    @Transactional
    public MentorApplicationSubmittedDto submit(
            List<Long> catalogSkillIds,
            String customSkill,
            String note,
            String expertiseSummary,
            String availabilityNotes,
            Integer maxConcurrentTrainees,
            List<MultipartFile> supportingEvidence,
            ApidUserPrincipal actor
    ) {
        String normalizedCustomSkill = normalizeOptional(customSkill);
        String normalizedExpertise = normalizeOptional(expertiseSummary);
        String normalizedAvailability = normalizeOptional(availabilityNotes);
        List<Long> requestedSkillIds = catalogSkillIds == null ? List.of() : catalogSkillIds;
        Set<Long> uniqueSkillIds = new LinkedHashSet<>(requestedSkillIds);
        if (uniqueSkillIds.size() != requestedSkillIds.size()) {
            throw new BusinessException(
                    "DUPLICATE_MENTOR_APPLICATION_SKILL",
                    "Choose each catalog skill only once."
            );
        }
        if (uniqueSkillIds.isEmpty() && normalizedCustomSkill == null) {
            throw new BusinessException(
                    "MENTOR_APPLICATION_SKILL_REQUIRED",
                    "Choose at least one catalog skill or enter a custom skill."
            );
        }
        if (normalizedCustomSkill != null && normalizedCustomSkill.length() > 150) {
            throw new BusinessException(
                    "MENTOR_APPLICATION_SKILL_TOO_LONG",
                    "Custom skill must be 150 characters or fewer."
            );
        }
        if (normalizedExpertise != null && normalizedExpertise.length() > 2000) {
            throw new BusinessException(
                    "MENTOR_APPLICATION_EXPERTISE_TOO_LONG",
                    "Expertise summary must be 2000 characters or fewer."
            );
        }
        if (normalizedAvailability != null && normalizedAvailability.length() > 1000) {
            throw new BusinessException(
                    "MENTOR_APPLICATION_AVAILABILITY_TOO_LONG",
                    "Availability notes must be 1000 characters or fewer."
            );
        }
        if (maxConcurrentTrainees != null && (maxConcurrentTrainees < 1 || maxConcurrentTrainees > 100)) {
            throw new BusinessException(
                    "INVALID_MENTOR_CAPACITY",
                    "Maximum concurrent trainees must be between 1 and 100."
            );
        }

        List<Skill> catalogSkills = uniqueSkillIds.stream()
                .map(skillId -> skillRepository.findByIdAndActiveTrue(skillId)
                        .orElseThrow(() -> new ResourceNotFoundException("Active catalog skill not found")))
                .toList();
        List<MultipartFile> evidenceUploads = supportingEvidence == null
                ? List.of()
                : supportingEvidence.stream()
                        .filter(file -> file != null && !file.isEmpty())
                        .toList();
        if (evidenceUploads.isEmpty()) {
            throw new BusinessException(
                    "MENTOR_APPLICATION_EVIDENCE_REQUIRED",
                    "Upload at least one supporting evidence file."
            );
        }

        User applicant = userRepository.findById(actor.getUserId())
                .orElseThrow(() -> new ResourceNotFoundException("Applicant account not found"));
        List<StoredFile> evidenceFiles = new ArrayList<>();
        for (MultipartFile evidenceUpload : evidenceUploads) {
            StoredFileDto uploadedFile = fileStorageService.store(evidenceUpload, FilePurpose.TRAINER_CERT, actor);
            StoredFile evidenceFile = storedFileRepository.findByIdAndDeletedFalse(uploadedFile.id())
                    .orElseThrow(() -> new ResourceNotFoundException("Uploaded proof document not found"));
            if (!actor.getUserId().equals(evidenceFile.getUploadedByUserId())
                    || evidenceFile.getPurpose() != FilePurpose.TRAINER_CERT) {
                throw new AccessDeniedException(
                        "Supporting evidence must be uploaded by the applicant for this application"
                );
            }
            evidenceFiles.add(evidenceFile);
        }

        MentorApplication application = new MentorApplication();
        application.setApplicant(applicant);
        application.setProofDocument(evidenceFiles.get(0));
        application.setSupportingEvidence(new LinkedHashSet<>(evidenceFiles));
        application.setCatalogSkill(catalogSkills.isEmpty() ? null : catalogSkills.get(0));
        application.setCatalogSkills(new LinkedHashSet<>(catalogSkills));
        application.setCustomSkill(normalizedCustomSkill);
        application.setNote(normalizeOptional(note));
        application.setExpertiseSummary(normalizedExpertise);
        application.setAvailabilityNotes(normalizedAvailability);
        application.setMaxConcurrentTrainees(maxConcurrentTrainees);

        MentorApplication saved = applicationRepository.save(application);
        return new MentorApplicationSubmittedDto(
                saved.getId(),
                saved.getStatus(),
                saved.getCatalogSkill() == null ? null : saved.getCatalogSkill().getId(),
                catalogSkills.stream().map(Skill::getId).toList(),
                saved.getCustomSkill(),
                saved.getSubmittedAt()
        );
    }

    @Transactional(readOnly = true)
    public List<MentorApplicationDto> listApplications() {
        return applicationRepository.findAllByOrderBySubmittedAtDesc().stream()
                .map(MentorApplicationDto::from)
                .toList();
    }

    @Transactional
    public MentorApplicationDto reviewApplication(
            Long applicationId,
            MentorApplicationReviewRequest request,
            ApidUserPrincipal actor
    ) {
        if (request == null || request.decision() == null
                || request.decision() == MentorApplicationStatus.PENDING) {
            throw new BusinessException(
                    "INVALID_MENTOR_APPLICATION_DECISION",
                    "A mentor application can only be approved or declined."
            );
        }

        String reason = normalizeOptional(request.reason());
        if (request.decision() == MentorApplicationStatus.DECLINED && reason == null) {
            throw new BusinessException(
                    "MENTOR_APPLICATION_DECLINE_REASON_REQUIRED",
                    "A reason is required when declining a mentor application."
            );
        }

        MentorApplication application = applicationRepository.findByIdForUpdate(applicationId)
                .orElseThrow(() -> new ResourceNotFoundException("Mentor application not found"));
        if (application.getStatus() != MentorApplicationStatus.PENDING) {
            throw new BusinessException(
                    "MENTOR_APPLICATION_ALREADY_REVIEWED",
                    "This mentor application has already been reviewed.",
                    HttpStatus.CONFLICT
            );
        }

        User applicant = userRepository.findByIdForUpdate(application.getApplicant().getId())
                .orElseThrow(() -> new ResourceNotFoundException("Applicant account not found"));
        if (request.decision() == MentorApplicationStatus.APPROVED) {
            approveApplicant(application, applicant, actor);
            User reviewer = userRepository.findById(actor.getUserId())
                    .orElseThrow(() -> new ResourceNotFoundException("Reviewer account not found"));
            trainerAuthorizationService.authorizeApplication(application, reviewer);
        }

        User reviewer = userRepository.findById(actor.getUserId())
                .orElseThrow(() -> new ResourceNotFoundException("Reviewer account not found"));
        Instant reviewedAt = Instant.now();
        application.setStatus(request.decision());
        application.setReviewedBy(reviewer);
        application.setReviewedAt(reviewedAt);
        application.setReviewReason(request.decision() == MentorApplicationStatus.DECLINED ? reason : null);
        MentorApplication saved = applicationRepository.save(application);

        String skillName = applicationSkillSummary(application);
        String notificationMessage = request.decision() == MentorApplicationStatus.APPROVED
                ? "Your mentor application for " + skillName + " was approved."
                : "Your mentor application for " + skillName + " was declined. Reason: " + reason;
        notificationService.notify(
                applicant.getId(),
                NotificationModule.MENTORING,
                request.decision() == MentorApplicationStatus.APPROVED
                        ? "MENTOR_APPLICATION_APPROVED"
                        : "MENTOR_APPLICATION_DECLINED",
                request.decision() == MentorApplicationStatus.APPROVED
                        ? "Mentor application approved"
                        : "Mentor application declined",
                notificationMessage,
                "/mentoring?tab=applications"
        );

        Map<String, Object> auditDetails = new LinkedHashMap<>();
        auditDetails.put("decision", request.decision().name());
        auditDetails.put("reason", application.getReviewReason());
        auditService.record(new AuditService.AuditCommand(
                null,
                actor.getUserId(),
                actor.getUsername(),
                applicant.getId(),
                "MENTORING",
                "MENTOR_APPLICATION_" + request.decision().name(),
                "SUCCESS",
                null,
                "MENTOR_APPLICATION",
                String.valueOf(application.getId()),
                auditDetails,
                null,
                null
        ));

        return MentorApplicationDto.from(saved);
    }

    private void approveApplicant(
            MentorApplication application,
            User applicant,
            ApidUserPrincipal actor
    ) {
        if (applicant.getStatus() != UserStatus.ACTIVE) {
            throw new BusinessException(
                    "INACTIVE_MENTOR_APPLICANT",
                    "A disabled account cannot be approved as a mentor.",
                    HttpStatus.CONFLICT
            );
        }

        Role mentorRole = roleRepository.findByNameIgnoreCase("Mentor")
                .filter(Role::isActive)
                .orElseThrow(() -> new BusinessException(
                        "MENTOR_ROLE_NOT_CONFIGURED",
                        "The active Mentor role is not configured.",
                        HttpStatus.INTERNAL_SERVER_ERROR
                ));
        boolean alreadyMentor = userRoleRepository.findActiveByUserIdWithRole(applicant.getId()).stream()
                .anyMatch(userRole -> userRole.getRole().getId().equals(mentorRole.getId()));
        if (!alreadyMentor) {
            UserRole userRole = new UserRole();
            userRole.setUser(applicant);
            userRole.setRole(mentorRole);
            userRole.setAssignedBy(userRepository.getReferenceById(actor.getUserId()));
            userRole.setActive(true);
            userRoleRepository.save(userRole);
            eventPublisher.publishEvent(PermissionCacheInvalidationEvent.forUser(applicant.getId()));
        }

        Set<Skill> skills = application.getCatalogSkills().isEmpty()
                ? (application.getCatalogSkill() == null ? Set.of() : Set.of(application.getCatalogSkill()))
                : application.getCatalogSkills();
        skills.forEach(applicant::addSkill);

        String customSkillName = normalizeOptional(application.getCustomSkill());
        if (customSkillName != null) {
            Skill customSkill = skillRepository.findByNameIgnoreCase(customSkillName)
                    .orElseGet(() -> createMentoringSkill(customSkillName));
            if (!customSkill.isActive()) {
                customSkill.setActive(true);
                customSkill = skillRepository.save(customSkill);
            }
            if (application.getCatalogSkills().isEmpty() && application.getCatalogSkill() != null) {
                application.getCatalogSkills().add(application.getCatalogSkill());
            }
            application.getCatalogSkills().add(customSkill);
            applicant.addSkill(customSkill);
            eventPublisher.publishEvent(new SkillCacheInvalidationEvent());
        }
    }

    private Skill createMentoringSkill(String name) {
        Skill skill = new Skill();
        skill.setName(name);
        skill.setCategory("Mentoring");
        skill.setDescription("Approved custom mentor skill");
        skill.setActive(true);
        return skillRepository.save(skill);
    }

    private String applicationSkillSummary(MentorApplication application) {
        List<String> skills = application.getCatalogSkills().stream()
                .map(Skill::getName)
                .toList();
        if (skills.isEmpty() && application.getCatalogSkill() != null) {
            skills = List.of(application.getCatalogSkill().getName());
        }
        String customSkill = normalizeOptional(application.getCustomSkill());
        if (customSkill != null && skills.stream().noneMatch(skill -> skill.equalsIgnoreCase(customSkill))) {
            skills = new java.util.ArrayList<>(skills);
            skills.add(customSkill);
        }
        return skills.isEmpty() ? "unspecified skills" : String.join(", ", skills);
    }

    private String normalizeOptional(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        return value.trim();
    }
}
