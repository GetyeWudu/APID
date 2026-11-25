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
import com.boa.apid.core.organization.entity.Employee;
import com.boa.apid.core.organization.repository.EmployeeRepository;
import com.boa.apid.core.notifications.entity.NotificationModule;
import com.boa.apid.core.notifications.service.NotificationService;
import com.boa.apid.core.skills.entity.Skill;
import com.boa.apid.core.skills.repository.SkillRepository;
import com.boa.apid.core.skills.service.SkillCacheInvalidationEvent;
import com.boa.apid.mentoring.ai.document.service.MentorProfileSummaryService;
import com.boa.apid.mentoring.application.dto.MentorApplicationDto;
import com.boa.apid.mentoring.application.dto.MentorProfileSummaryDto;
import com.boa.apid.mentoring.application.dto.MentorApplicationReviewRequest;
import com.boa.apid.mentoring.application.dto.MentorApplicationSubmittedDto;
import com.boa.apid.mentoring.application.dto.MentorAgreementTermsDto;
import com.boa.apid.mentoring.application.dto.MentorProfileUpdateRequest;
import com.boa.apid.mentoring.application.entity.MentorApplication;
import com.boa.apid.mentoring.application.entity.MentorApplicationReviewScope;
import com.boa.apid.mentoring.application.entity.MentorApplicationStatus;
import com.boa.apid.mentoring.application.entity.MentorApplicationType;
import com.boa.apid.mentoring.application.repository.MentorApplicationRepository;
import com.boa.apid.mentoring.trainer.dto.TrainerSkillDto;
import com.boa.apid.mentoring.trainer.entity.TrainerAuthorizationStatus;
import com.boa.apid.mentoring.trainer.dto.TrainerRosterDto;
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
    private final EmployeeRepository employeeRepository;
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
    private final MentorProfileSummaryService profileSummaryService;

    public MentorApplicationService(
            MentorApplicationRepository applicationRepository,
            EmployeeRepository employeeRepository,
            UserRepository userRepository,
            SkillRepository skillRepository,
            StoredFileRepository storedFileRepository,
            FileStorageService fileStorageService,
            RoleRepository roleRepository,
            UserRoleRepository userRoleRepository,
            AuditService auditService,
            NotificationService notificationService,
            ApplicationEventPublisher eventPublisher,
            TrainerAuthorizationService trainerAuthorizationService,
            MentorProfileSummaryService profileSummaryService
    ) {
        this.applicationRepository = applicationRepository;
        this.employeeRepository = employeeRepository;
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
        this.profileSummaryService = profileSummaryService;
    }

    @Transactional(readOnly = true)
    public MentorAgreementTermsDto getAgreementTerms() {
        return MentorAgreementPolicy.terms();
    }

    @Transactional
    public MentorApplicationSubmittedDto submit(
            Long catalogSkillId,
            String customSkill,
            String note,
            MultipartFile proofDocument,
            ApidUserPrincipal actor
    ) {
        return submit(
                catalogSkillId == null ? List.of() : List.of(catalogSkillId),
                customSkill,
                note,
                null,
                null,
                null,
                null,
                null,
                proofDocument == null ? List.of() : List.of(proofDocument),
                List.of(),
                false,
                null,
                actor
        );
    }

    @Transactional
    public MentorApplicationSubmittedDto submit(
            List<Long> catalogSkillIds,
            String customSkill,
            String note,
            String expertiseSummary,
            Integer experienceYears,
            String mentoringApproach,
            Integer sessionsPerWeek,
            Integer maxConcurrentTrainees,
            List<MultipartFile> supportingEvidence,
            List<String> supportingEvidenceContexts,
            Boolean mentorAgreementAccepted,
            String mentorAgreementVersion,
            ApidUserPrincipal actor
    ) {
        return submitApplication(
                catalogSkillIds,
                customSkill,
                note,
                expertiseSummary,
                experienceYears,
                mentoringApproach,
                sessionsPerWeek,
                maxConcurrentTrainees,
                supportingEvidence,
                supportingEvidenceContexts,
                actor,
                MentorApplicationType.INITIAL,
                mentorAgreementAccepted,
                mentorAgreementVersion
        );
    }

    @Transactional
    public MentorApplicationSubmittedDto submitSkillAddition(
            List<Long> catalogSkillIds,
            String customSkill,
            String note,
            List<MultipartFile> supportingEvidence,
            ApidUserPrincipal actor
    ) {
        return submitApplication(
                catalogSkillIds,
                customSkill,
                note,
                null,
                null,
                null,
                null,
                null,
                supportingEvidence,
                List.of(),
                actor,
                MentorApplicationType.SKILL_ADDITION,
                false,
                null
        );
    }

    @Transactional
    public MentorApplicationSubmittedDto submitProfileUpdate(
            MentorProfileUpdateRequest request,
            List<MultipartFile> supportingEvidence,
            ApidUserPrincipal actor
    ) {
        TrainerRosterDto currentProfile = trainerAuthorizationService.getOwnProfile(actor);
        User applicant = userRepository.findByIdForUpdate(actor.getUserId())
                .orElseThrow(() -> new ResourceNotFoundException("Mentor account not found"));
        boolean hrAdminApplicant = userRoleRepository.findActiveByUserIdWithRole(applicant.getId()).stream()
                .anyMatch(userRole -> userRole.getRole().isActive()
                        && "HR Admin".equalsIgnoreCase(userRole.getRole().getName()));
        String approach = normalizeOptional(request.mentoringApproach());
        if (request.experienceYears() != null && request.experienceYears() < 0) {
            throw new BusinessException("INVALID_MENTOR_EXPERIENCE", "Years of experience cannot be negative.");
        }
        if (request.sessionsPerWeek() != null && request.sessionsPerWeek() < 0) {
            throw new BusinessException(
                    "INVALID_MENTOR_WEEKLY_SESSIONS",
                    "Sessions per week cannot be negative."
            );
        }
        if (approach != null && approach.length() > 2000) {
            throw new BusinessException(
                    "MENTOR_APPLICATION_APPROACH_TOO_LONG",
                    "Mentoring approach must be 2000 characters or fewer."
            );
        }
        String profileDetails = request.profileDetails().trim();

        List<Long> requestedSkillIds = request.catalogSkillIds() == null
                ? List.of()
                : request.catalogSkillIds();
        Set<Long> uniqueSkillIds = new LinkedHashSet<>(requestedSkillIds);
        if (uniqueSkillIds.size() != requestedSkillIds.size()) {
            throw new BusinessException(
                    "DUPLICATE_MENTOR_APPLICATION_SKILL",
                    "Choose each catalog skill only once."
            );
        }
        List<Skill> requestedSkills = uniqueSkillIds.stream()
                .map(skillId -> skillRepository.findByIdAndActiveTrue(skillId)
                        .orElseThrow(() -> new ResourceNotFoundException("Active catalog skill not found")))
                .toList();
        List<String> requestedCustomSkills = normalizeCustomSkills(request.customSkill());
        Set<Long> activeSkillIds = currentProfile.skills().stream()
                .filter(skill -> skill.status() == TrainerAuthorizationStatus.ACTIVE)
                .map(TrainerSkillDto::id)
                .collect(java.util.stream.Collectors.toSet());
        Set<String> activeSkillNames = currentProfile.skills().stream()
                .filter(skill -> skill.status() == TrainerAuthorizationStatus.ACTIVE)
                .map(skill -> skill.name().toLowerCase(java.util.Locale.ROOT))
                .collect(java.util.stream.Collectors.toSet());
        List<Skill> newSkills = requestedSkills.stream()
                .filter(skill -> !activeSkillIds.contains(skill.getId()))
                .toList();
        List<String> newCustomSkills = requestedCustomSkills.stream()
                .filter(skill -> !activeSkillNames.contains(skill.toLowerCase(java.util.Locale.ROOT)))
                .toList();
        if (requestedSkills.isEmpty() && requestedCustomSkills.isEmpty()) {
            throw new BusinessException(
                    "MENTOR_APPLICATION_SKILL_REQUIRED",
                    "Keep at least one mentoring skill in your profile."
            );
        }
        if (requestedCustomSkills.stream().anyMatch(skill -> skill.length() > 150)) {
            throw new BusinessException(
                    "MENTOR_APPLICATION_SKILL_TOO_LONG",
                    "Each custom skill must be 150 characters or fewer."
            );
        }
        List<MentorApplication> pendingSkillRequests =
                applicationRepository.findAllByApplicant_IdAndApplicationTypeAndStatus(
                        applicant.getId(),
                        MentorApplicationType.SKILL_ADDITION,
                        MentorApplicationStatus.PENDING
                );
        Set<Long> pendingSkillIds = pendingSkillRequests.stream()
                .flatMap(pending -> pending.getCatalogSkills().stream())
                .map(Skill::getId)
                .collect(java.util.stream.Collectors.toSet());
        Set<String> pendingCustomSkills = pendingSkillRequests.stream()
                .map(MentorApplication::getCustomSkill)
                .filter(java.util.Objects::nonNull)
                .flatMap(skill -> normalizeCustomSkills(skill).stream())
                .map(skill -> skill.toLowerCase(java.util.Locale.ROOT))
                .collect(java.util.stream.Collectors.toSet());
        if (newSkills.stream().anyMatch(skill -> pendingSkillIds.contains(skill.getId()))
                || newCustomSkills.stream().anyMatch(skill ->
                        pendingCustomSkills.contains(skill.toLowerCase(java.util.Locale.ROOT)))) {
            throw new BusinessException(
                    "MENTOR_SKILL_ALREADY_PENDING",
                    "A requested skill is already awaiting review."
            );
        }

        List<MultipartFile> evidenceUploads = supportingEvidence == null
                ? List.of()
                : supportingEvidence.stream()
                        .filter(file -> file != null && !file.isEmpty())
                        .toList();
        if ((!newSkills.isEmpty() || !newCustomSkills.isEmpty()) && evidenceUploads.isEmpty()) {
            throw new BusinessException(
                    "MENTOR_APPLICATION_EVIDENCE_REQUIRED",
                    "Upload supporting evidence when requesting new skills."
            );
        }
        String currentApproach = currentProfile.mentoringApproach() == null
                ? currentProfile.bio()
                : currentProfile.mentoringApproach();
        boolean hasNewSkills = !newSkills.isEmpty() || !newCustomSkills.isEmpty();
        if (java.util.Objects.equals(currentApproach, approach)
                && java.util.Objects.equals(currentProfile.experienceYears(), request.experienceYears())
                && java.util.Objects.equals(currentProfile.sessionsPerWeek(), request.sessionsPerWeek())
                && java.util.Objects.equals(
                        normalizeOptional(currentProfile.profileApplicationDetails()),
                        normalizeOptional(profileDetails))
                && !hasNewSkills
                && normalizeOptional(request.changeNote()) == null
                && evidenceUploads.isEmpty()) {
            throw new BusinessException(
                    "MENTOR_PROFILE_UNCHANGED",
                    "Change at least one profile field before submitting a request."
            );
        }

        List<MentorApplication> pendingRequests = applicationRepository.findAllByApplicant_IdAndApplicationTypeAndStatus(
                applicant.getId(),
                MentorApplicationType.PROFILE_UPDATE,
                MentorApplicationStatus.PENDING
        );
        if (!pendingRequests.isEmpty()) {
            throw new BusinessException(
                    "MENTOR_PROFILE_UPDATE_ALREADY_PENDING",
                    "Your mentor profile update is already awaiting review.",
                    HttpStatus.CONFLICT
            );
        }

        List<StoredFile> evidenceFiles = new ArrayList<>();
        List<String> evidenceContexts = request.supportingEvidenceContexts() == null
                ? List.of()
                : request.supportingEvidenceContexts();
        for (int index = 0; index < evidenceUploads.size(); index++) {
            MultipartFile evidenceUpload = evidenceUploads.get(index);
            StoredFileDto uploadedFile = fileStorageService.store(
                    evidenceUpload,
                    FilePurpose.TRAINER_CERT,
                    actor
            );
            StoredFile evidenceFile = storedFileRepository.findByIdAndDeletedFalse(uploadedFile.id())
                    .orElseThrow(() -> new ResourceNotFoundException("Uploaded profile evidence not found"));
            if (!actor.getUserId().equals(evidenceFile.getUploadedByUserId())
                    || evidenceFile.getPurpose() != FilePurpose.TRAINER_CERT) {
                throw new AccessDeniedException("Profile evidence must be uploaded by the mentor.");
            }
            evidenceFiles.add(evidenceFile);
        }

        MentorApplication application = new MentorApplication();
        application.setApplicant(applicant);
        application.setApplicationType(MentorApplicationType.PROFILE_UPDATE);
        application.setReviewScope(hrAdminApplicant
                ? MentorApplicationReviewScope.SUPER_ADMIN
                : MentorApplicationReviewScope.HR);
        String changeNote = normalizeOptional(request.changeNote());
        application.setNote(changeNote == null
                ? profileDetails
                : profileDetails + "\nRequested changes: "
                        + changeNote.replace('\r', ' ').replace('\n', ' '));
        application.setProofDocument(evidenceFiles.isEmpty() ? null : evidenceFiles.get(0));
        application.setSupportingEvidence(new LinkedHashSet<>(evidenceFiles));
        application.setEvidenceContexts(encodeEvidenceContexts(evidenceFiles, evidenceContexts));
        application.setCatalogSkill(newSkills.isEmpty() ? null : newSkills.get(0));
        application.setCatalogSkills(new LinkedHashSet<>(newSkills));
        application.setCustomSkill(newCustomSkills.isEmpty() ? null : String.join("; ", newCustomSkills));
        application.setExpertiseSummary(java.util.stream.Stream.concat(
                requestedSkills.stream().map(Skill::getName),
                requestedCustomSkills.stream()
        ).distinct().collect(java.util.stream.Collectors.joining(", ")));
        application.setExperienceYears(request.experienceYears());
        application.setMentoringApproach(approach);
        application.setSessionsPerWeek(request.sessionsPerWeek());
        MentorApplication saved = applicationRepository.save(application);
        return new MentorApplicationSubmittedDto(
                saved.getId(),
                saved.getApplicationType(),
                saved.getStatus(),
                saved.getCatalogSkill() == null ? null : saved.getCatalogSkill().getId(),
                newSkills.stream().map(Skill::getId).toList(),
                saved.getCustomSkill(),
                saved.getSubmittedAt()
        );
    }

    private MentorApplicationSubmittedDto submitApplication(
            List<Long> catalogSkillIds,
            String customSkill,
            String note,
            String expertiseSummary,
            Integer experienceYears,
            String mentoringApproach,
            Integer sessionsPerWeek,
            Integer maxConcurrentTrainees,
            List<MultipartFile> supportingEvidence,
            List<String> supportingEvidenceContexts,
            ApidUserPrincipal actor,
            MentorApplicationType applicationType,
            Boolean mentorAgreementAccepted,
            String mentorAgreementVersion
    ) {
        if (applicationType == MentorApplicationType.INITIAL) {
            if (!Boolean.TRUE.equals(mentorAgreementAccepted)) {
                throw new BusinessException(
                        "MENTOR_AGREEMENT_REQUIRED",
                        "You must accept the mentor agreement before submitting your application."
                );
            }
            if (!MentorAgreementPolicy.VERSION.equals(mentorAgreementVersion)) {
                throw new BusinessException(
                        "MENTOR_AGREEMENT_VERSION_OUTDATED",
                        "The mentor agreement has changed. Review and accept the current terms before submitting.",
                        HttpStatus.CONFLICT
                );
            }
        }

        List<String> customSkillNames = normalizeCustomSkills(customSkill);
        String normalizedCustomSkill = customSkillNames.isEmpty()
                ? null
                : String.join("; ", customSkillNames);
        String normalizedExpertise = normalizeOptional(expertiseSummary);
        String normalizedApproach = normalizeOptional(mentoringApproach);
        List<Long> requestedSkillIds = catalogSkillIds == null ? List.of() : catalogSkillIds;
        Set<Long> uniqueSkillIds = new LinkedHashSet<>(requestedSkillIds);
        if (uniqueSkillIds.size() != requestedSkillIds.size()) {
            throw new BusinessException(
                    "DUPLICATE_MENTOR_APPLICATION_SKILL",
                    "Choose each catalog skill only once."
            );
        }
        if (uniqueSkillIds.isEmpty() && customSkillNames.isEmpty()) {
            throw new BusinessException(
                    "MENTOR_APPLICATION_SKILL_REQUIRED",
                    "Choose at least one catalog skill or enter a custom skill."
            );
        }
        if (customSkillNames.stream().anyMatch(skill -> skill.length() > 150)
                || (normalizedCustomSkill != null && normalizedCustomSkill.length() > 1000)) {
            throw new BusinessException(
                    "MENTOR_APPLICATION_SKILL_TOO_LONG",
                    "Each custom skill must be 150 characters or fewer."
            );
        }
        if (normalizedExpertise != null && normalizedExpertise.length() > 2000) {
            throw new BusinessException(
                    "MENTOR_APPLICATION_EXPERTISE_TOO_LONG",
                    "Expertise summary must be 2000 characters or fewer."
            );
        }
        if (experienceYears != null && experienceYears < 0) {
            throw new BusinessException(
                    "INVALID_MENTOR_EXPERIENCE",
                    "Years of experience cannot be negative."
            );
        }
        if (normalizedApproach != null && normalizedApproach.length() > 2000) {
            throw new BusinessException(
                    "MENTOR_APPLICATION_APPROACH_TOO_LONG",
                    "Mentoring approach must be 2000 characters or fewer."
            );
        }
        if (sessionsPerWeek != null && sessionsPerWeek < 0) {
            throw new BusinessException(
                    "INVALID_MENTOR_WEEKLY_SESSIONS",
                    "Sessions per week cannot be negative."
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

        User applicant = userRepository.findByIdForUpdate(actor.getUserId())
                .orElseThrow(() -> new ResourceNotFoundException("Applicant account not found"));
        List<UserRole> activeRoles = userRoleRepository.findActiveByUserIdWithRole(applicant.getId());
        boolean alreadyMentor = activeRoles.stream()
                .anyMatch(userRole -> userRole.getRole().isActive()
                        && "mentor".equalsIgnoreCase(userRole.getRole().getName()));
        boolean hrAdminApplicant = activeRoles.stream()
                .anyMatch(userRole -> userRole.getRole().isActive()
                        && "HR Admin".equalsIgnoreCase(userRole.getRole().getName()));

        if (applicationType == MentorApplicationType.INITIAL) {
            if (applicationRepository.existsByApplicant_IdAndApplicationTypeAndStatusIn(
                    applicant.getId(),
                    MentorApplicationType.INITIAL,
                    List.of(MentorApplicationStatus.PENDING, MentorApplicationStatus.APPROVED)
            )) {
                throw new BusinessException(
                        "MENTOR_APPLICATION_ALREADY_SUBMITTED",
                        "You already have an active or approved mentor application.",
                        HttpStatus.CONFLICT
                );
            }
            if (alreadyMentor) {
                throw new BusinessException(
                        "ALREADY_APPROVED_MENTOR",
                        "You are already an approved mentor. Request additional skills from your mentor profile.",
                        HttpStatus.CONFLICT
                );
            }
        } else {
            if (!alreadyMentor) {
                throw new BusinessException(
                        "ACTIVE_MENTOR_REQUIRED",
                        "Only an approved mentor can request additional skills.",
                        HttpStatus.FORBIDDEN
                );
            }
            List<TrainerSkillDto> activeTrainerSkills = trainerAuthorizationService.getOwnProfile(actor).skills();
            Set<Long> activeSkillIds = activeTrainerSkills.stream()
                    .map(TrainerSkillDto::id)
                    .collect(java.util.stream.Collectors.toSet());
            List<MentorApplication> pendingAdditions =
                    applicationRepository.findAllByApplicant_IdAndApplicationTypeAndStatus(
                            applicant.getId(),
                            MentorApplicationType.SKILL_ADDITION,
                            MentorApplicationStatus.PENDING
                    );
            Set<Long> pendingSkillIds = pendingAdditions.stream()
                    .flatMap(application -> application.getCatalogSkills().stream())
                    .map(Skill::getId)
                    .collect(java.util.stream.Collectors.toSet());
            boolean customSkillAlreadyActive = customSkillNames.stream()
                    .anyMatch(customName -> activeTrainerSkills.stream()
                            .anyMatch(skill -> customName.equalsIgnoreCase(skill.name())));
            boolean customSkillAlreadyPending = customSkillNames.stream()
                    .anyMatch(customName -> pendingAdditions.stream()
                            .map(MentorApplication::getCustomSkill)
                            .filter(existingSkill -> existingSkill != null)
                            .flatMap(existingSkill -> normalizeCustomSkills(existingSkill).stream())
                            .anyMatch(existingSkill -> customName.equalsIgnoreCase(existingSkill)));
            if (uniqueSkillIds.stream().anyMatch(skillId ->
                    activeSkillIds.contains(skillId) || pendingSkillIds.contains(skillId))
                    || customSkillAlreadyActive
                    || customSkillAlreadyPending) {
                throw new BusinessException(
                        "MENTOR_SKILL_ALREADY_ACTIVE_OR_PENDING",
                        "One or more selected skills are already active or awaiting review.",
                        HttpStatus.CONFLICT
                );
            }
        }

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
        application.setApplicationType(applicationType);
        application.setReviewScope(applicationType == MentorApplicationType.INITIAL && hrAdminApplicant
                ? MentorApplicationReviewScope.SUPER_ADMIN
                : MentorApplicationReviewScope.HR);
        application.setProofDocument(evidenceFiles.get(0));
        application.setSupportingEvidence(new LinkedHashSet<>(evidenceFiles));
        application.setEvidenceContexts(encodeEvidenceContexts(evidenceFiles, supportingEvidenceContexts));
        application.setCatalogSkill(catalogSkills.isEmpty() ? null : catalogSkills.get(0));
        application.setCatalogSkills(new LinkedHashSet<>(catalogSkills));
        application.setCustomSkill(normalizedCustomSkill);
        application.setNote(normalizeOptional(note));
        application.setExpertiseSummary(normalizedExpertise);
        application.setExperienceYears(experienceYears);
        application.setMentoringApproach(normalizedApproach);
        application.setSessionsPerWeek(sessionsPerWeek);
        application.setMaxConcurrentTrainees(maxConcurrentTrainees);
        if (applicationType == MentorApplicationType.INITIAL) {
            application.setMentorAgreementVersion(MentorAgreementPolicy.VERSION);
            application.setMentorAgreementText(MentorAgreementPolicy.snapshot());
            application.setMentorAgreementAcceptedAt(Instant.now());
        }

        MentorApplication saved = applicationRepository.save(application);
        return new MentorApplicationSubmittedDto(
                saved.getId(),
                saved.getApplicationType(),
                saved.getStatus(),
                saved.getCatalogSkill() == null ? null : saved.getCatalogSkill().getId(),
                catalogSkills.stream().map(Skill::getId).toList(),
                saved.getCustomSkill(),
                saved.getSubmittedAt()
        );
    }

    @Transactional(readOnly = true)
    public List<MentorApplicationDto> listApplications() {
        return withApplicantLocations(
                applicationRepository.findAllByReviewScopeOrderBySubmittedAtDesc(MentorApplicationReviewScope.HR)
        );
    }

    @Transactional(readOnly = true)
    public List<MentorApplicationDto> listSuperAdminApplications() {
        return withApplicantLocations(
                applicationRepository.findAllByReviewScopeOrderBySubmittedAtDesc(
                        MentorApplicationReviewScope.SUPER_ADMIN
                )
        );
    }

    private List<MentorApplicationDto> withApplicantLocations(List<MentorApplication> applications) {
        if (applications.isEmpty()) {
            return List.of();
        }
        Map<Long, Employee> employeesByUserId = employeeRepository.findDetailedByUserIdIn(
                        applications.stream().map(application -> application.getApplicant().getId()).distinct().toList()
                ).stream()
                .collect(java.util.stream.Collectors.toMap(Employee::getUserId, employee -> employee));
        return applications.stream()
                .map(application -> MentorApplicationDto.from(
                        application,
                        employeesByUserId.get(application.getApplicant().getId())
                ))
                .toList();
    }

    @Transactional(readOnly = true)
    public List<MentorApplicationDto> listMyApplications(ApidUserPrincipal actor) {
        return applicationRepository.findAllByApplicant_IdOrderBySubmittedAtDesc(actor.getUserId()).stream()
                .map(MentorApplicationDto::from)
                .toList();
    }

    @Transactional
    public MentorProfileSummaryDto summarizeProfile(Long applicationId, ApidUserPrincipal actor) {
        MentorApplication application = applicationRepository.findById(applicationId)
                .orElseThrow(() -> new ResourceNotFoundException("Mentor application not found"));
        ensureReviewerCanReview(application, actor);
        if (application.getApplicationType() == MentorApplicationType.SKILL_ADDITION) {
            throw new BusinessException(
                    "MENTOR_PROFILE_SUMMARY_NOT_APPLICABLE",
                    "A profile summary is not available for a skill-only request.",
                    HttpStatus.CONFLICT
            );
        }
        if (application.getStatus() == MentorApplicationStatus.DECLINED) {
            throw new BusinessException(
                    "MENTOR_PROFILE_SUMMARY_NOT_APPLICABLE",
                    "A profile summary is not available for a declined application.",
                    HttpStatus.CONFLICT
            );
        }

        boolean alreadyApproved = application.getStatus() == MentorApplicationStatus.APPROVED;
        MentorApplication profile = application;
        List<MentorApplication> relatedEvidence = List.of();
        if (application.getApplicationType() == MentorApplicationType.PROFILE_UPDATE) {
            MentorApplication existingProfile = trainerAuthorizationService
                    .findActiveProfileApplication(application.getApplicant().getId())
                    .orElse(null);
            if (alreadyApproved && existingProfile != null) {
                profile = existingProfile;
            } else if (existingProfile != null) {
                relatedEvidence = List.of(existingProfile);
            }
        }

        String summary = profileSummaryService.summarize(profile, relatedEvidence);
        if (alreadyApproved) {
            profile.setProfileSummary(summary);
            applicationRepository.save(profile);
            if (profile != application) {
                application.setProfileSummary(summary);
                applicationRepository.save(application);
            }
        }
        return new MentorProfileSummaryDto(applicationId, summary, alreadyApproved);
    }

    @Transactional(readOnly = true)
    public void authorizeApplicationReview(Long applicationId, ApidUserPrincipal actor) {
        MentorApplication application = applicationRepository.findById(applicationId)
                .orElseThrow(() -> new ResourceNotFoundException("Mentor application not found"));
        ensureReviewerCanReview(application, actor);
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
        ensureReviewerCanReview(application, actor);
        if (application.getStatus() != MentorApplicationStatus.PENDING) {
            throw new BusinessException(
                    "MENTOR_APPLICATION_ALREADY_REVIEWED",
                    "This mentor application has already been reviewed.",
                    HttpStatus.CONFLICT
            );
        }

        String profileSummary = normalizeOptional(request.profileSummary());
        if (request.decision() == MentorApplicationStatus.APPROVED
                && application.getApplicationType() != MentorApplicationType.SKILL_ADDITION) {
            if (profileSummary == null) {
                List<MentorApplication> relatedEvidence = application.getApplicationType()
                        == MentorApplicationType.PROFILE_UPDATE
                        ? trainerAuthorizationService.findActiveProfileApplication(
                                application.getApplicant().getId()
                        ).map(List::of).orElseGet(List::of)
                        : List.of();
                profileSummary = profileSummaryService.summarize(application, relatedEvidence);
            }
            if (profileSummary == null || profileSummary.isBlank()
                    || profileSummary.length() > MentorProfileSummaryService.MAX_SUMMARY_CHARS) {
                throw new BusinessException(
                        "MENTOR_PROFILE_SUMMARY_INVALID",
                        "A valid AI profile summary is required to approve this mentor.",
                        HttpStatus.BAD_GATEWAY
                );
            }
            application.setProfileSummary(profileSummary);
        }

        User applicant = userRepository.findByIdForUpdate(application.getApplicant().getId())
                .orElseThrow(() -> new ResourceNotFoundException("Applicant account not found"));
        User reviewer = userRepository.findById(actor.getUserId())
                .orElseThrow(() -> new ResourceNotFoundException("Reviewer account not found"));
        if (request.decision() == MentorApplicationStatus.APPROVED) {
            if (application.getApplicationType() == MentorApplicationType.PROFILE_UPDATE) {
                trainerAuthorizationService.approveProfileUpdate(application, profileSummary);
                if (!application.getCatalogSkills().isEmpty()
                        || normalizeOptional(application.getCustomSkill()) != null) {
                    trainerAuthorizationService.authorizeApplication(application, reviewer);
                }
            } else {
                approveApplicant(application, applicant, actor);
                trainerAuthorizationService.authorizeApplication(application, reviewer);
            }
        }

        Instant reviewedAt = Instant.now();
        application.setStatus(request.decision());
        application.setReviewedBy(reviewer);
        application.setReviewedAt(reviewedAt);
        application.setReviewReason(request.decision() == MentorApplicationStatus.DECLINED ? reason : null);
        MentorApplication saved = applicationRepository.save(application);

        String skillName = applicationSkillSummary(application);
        boolean skillAddition = application.getApplicationType() == MentorApplicationType.SKILL_ADDITION;
        boolean profileUpdate = application.getApplicationType() == MentorApplicationType.PROFILE_UPDATE;
        String requestName = skillAddition ? "additional skill request"
                : profileUpdate ? "mentor profile update request" : "mentor application";
        String notificationMessage = profileUpdate
                ? request.decision() == MentorApplicationStatus.APPROVED
                    ? "Your mentor profile update was approved."
                    : "Your mentor profile update was declined. Reason: " + reason
                : request.decision() == MentorApplicationStatus.APPROVED
                    ? "Your " + requestName + " for " + skillName + " was approved."
                    : "Your " + requestName + " for " + skillName + " was declined. Reason: " + reason;
        notificationService.notify(
                applicant.getId(),
                NotificationModule.MENTORING,
                skillAddition
                        ? request.decision() == MentorApplicationStatus.APPROVED
                            ? "MENTOR_SKILL_ADDITION_APPROVED"
                            : "MENTOR_SKILL_ADDITION_DECLINED"
                        : profileUpdate
                            ? request.decision() == MentorApplicationStatus.APPROVED
                                ? "MENTOR_PROFILE_UPDATE_APPROVED"
                                : "MENTOR_PROFILE_UPDATE_DECLINED"
                            : request.decision() == MentorApplicationStatus.APPROVED
                            ? "MENTOR_APPLICATION_APPROVED"
                            : "MENTOR_APPLICATION_DECLINED",
                skillAddition
                        ? request.decision() == MentorApplicationStatus.APPROVED
                            ? "Mentor skill request approved"
                            : "Mentor skill request declined"
                        : profileUpdate
                            ? request.decision() == MentorApplicationStatus.APPROVED
                                ? "Mentor profile update approved"
                                : "Mentor profile update declined"
                            : request.decision() == MentorApplicationStatus.APPROVED
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
                (skillAddition ? "MENTOR_SKILL_ADDITION_"
                        : profileUpdate ? "MENTOR_PROFILE_UPDATE_" : "MENTOR_APPLICATION_")
                        + request.decision().name(),
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

    private void ensureReviewerCanReview(MentorApplication application, ApidUserPrincipal actor) {
        String requiredPermission = application.getReviewScope() == MentorApplicationReviewScope.SUPER_ADMIN
                ? "TRAINER_APPLICATION_SUPER_REVIEW"
                : "TRAINER_APPLICATION_REVIEW";
        if (!actor.getPermissions().contains(requiredPermission)) {
            throw new AccessDeniedException("You are not authorized to review this mentor application.");
        }
        if (application.getApplicant().getId().equals(actor.getUserId())) {
            throw new AccessDeniedException("Applicants cannot review their own mentor applications.");
        }
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
        List<UserRole> activeRoles = userRoleRepository.findActiveByUserIdWithRole(applicant.getId());
        UserRole mentorUserRole = activeRoles.stream()
                .filter(userRole -> userRole.getRole().getId().equals(mentorRole.getId()))
                .findFirst()
                .orElse(null);
        boolean roleCreated = mentorUserRole == null;
        if (roleCreated) {
            mentorUserRole = new UserRole();
            mentorUserRole.setUser(applicant);
            mentorUserRole.setRole(mentorRole);
            mentorUserRole.setAssignedBy(userRepository.getReferenceById(actor.getUserId()));
            mentorUserRole.setActive(true);
        }
        if (application.getApplicationType() == MentorApplicationType.INITIAL
                && application.getMentorAgreementVersion() != null
                && application.getMentorAgreementText() != null
                && application.getMentorAgreementAcceptedAt() != null) {
            mentorUserRole.setMentorAgreementVersion(application.getMentorAgreementVersion());
            mentorUserRole.setMentorAgreementText(application.getMentorAgreementText());
            mentorUserRole.setMentorAgreementAcceptedAt(application.getMentorAgreementAcceptedAt());
        }
        if (roleCreated || (application.getApplicationType() == MentorApplicationType.INITIAL
                && application.getMentorAgreementAcceptedAt() != null)) {
            userRoleRepository.save(mentorUserRole);
        }
        if (roleCreated) {
            eventPublisher.publishEvent(PermissionCacheInvalidationEvent.forUser(applicant.getId()));
        }

        Set<Skill> skills = application.getCatalogSkills().isEmpty()
                ? (application.getCatalogSkill() == null ? Set.of() : Set.of(application.getCatalogSkill()))
                : application.getCatalogSkills();
        skills.forEach(applicant::addSkill);

        for (String customSkillName : normalizeCustomSkills(application.getCustomSkill())) {
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
        if (application.getApplicationType() == MentorApplicationType.PROFILE_UPDATE) {
            return "profile details";
        }
        List<String> skills = new ArrayList<>(application.getCatalogSkills().stream()
                .map(Skill::getName)
                .toList());
        if (skills.isEmpty() && application.getCatalogSkill() != null) {
            skills.add(application.getCatalogSkill().getName());
        }
        List<String> customSkills = normalizeCustomSkills(application.getCustomSkill());
        for (String customSkill : customSkills) {
            if (skills.stream().noneMatch(skill -> skill.equalsIgnoreCase(customSkill))) {
                skills.add(customSkill);
            }
        }
        return skills.isEmpty() ? "unspecified skills" : String.join(", ", skills);
    }

    private String normalizeOptional(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        return value.trim();
    }

    private String encodeEvidenceContexts(List<StoredFile> files, List<String> contexts) {
        StringBuilder encoded = new StringBuilder();
        for (int index = 0; index < files.size(); index++) {
            String context = contexts != null && index < contexts.size()
                    ? contexts.get(index)
                    : "Supporting evidence";
            context = context == null ? "" : context.replaceAll("[\\t\\r\\n]", " ").trim();
            if (context.length() > 160) {
                context = context.substring(0, 160);
            }
            if (encoded.length() > 0) {
                encoded.append('\n');
            }
            encoded.append(files.get(index).getId()).append('\t').append(context);
        }
        return encoded.length() == 0 ? null : encoded.toString();
    }

    private List<String> normalizeCustomSkills(String value) {
        if (value == null || value.isBlank()) {
            return List.of();
        }
        return java.util.Arrays.stream(value.split(";"))
                .map(String::trim)
                .filter(skill -> !skill.isBlank())
                .distinct()
                .toList();
    }
}
