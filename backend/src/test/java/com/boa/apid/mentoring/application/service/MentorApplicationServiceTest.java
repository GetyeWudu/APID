package com.boa.apid.mentoring.application.service;

import com.boa.apid.common.exception.BusinessException;
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
import com.boa.apid.core.authorization.repository.RoleRepository;
import com.boa.apid.core.authorization.repository.UserRepository;
import com.boa.apid.core.authorization.repository.UserRoleRepository;
import com.boa.apid.core.notifications.service.NotificationService;
import com.boa.apid.core.skills.entity.Skill;
import com.boa.apid.core.skills.repository.SkillRepository;
import com.boa.apid.core.skills.service.SkillCacheInvalidationEvent;
import com.boa.apid.mentoring.application.dto.MentorApplicationDto;
import com.boa.apid.mentoring.application.dto.MentorApplicationReviewRequest;
import com.boa.apid.mentoring.application.entity.MentorApplication;
import com.boa.apid.mentoring.application.entity.MentorApplicationStatus;
import com.boa.apid.mentoring.application.entity.MentorApplicationType;
import com.boa.apid.mentoring.application.repository.MentorApplicationRepository;
import com.boa.apid.mentoring.trainer.dto.TrainerRosterDto;
import com.boa.apid.mentoring.trainer.entity.TrainerAuthorizationSource;
import com.boa.apid.mentoring.trainer.entity.TrainerAuthorizationStatus;
import com.boa.apid.mentoring.trainer.service.TrainerAuthorizationService;
import org.springframework.context.ApplicationEventPublisher;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockMultipartFile;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class MentorApplicationServiceTest {

    @Mock
    private MentorApplicationRepository applicationRepository;

    @Mock
    private UserRepository userRepository;

    @Mock
    private SkillRepository skillRepository;

    @Mock
    private StoredFileRepository storedFileRepository;

    @Mock
    private FileStorageService fileStorageService;

    @Mock
    private RoleRepository roleRepository;

    @Mock
    private UserRoleRepository userRoleRepository;

    @Mock
    private AuditService auditService;

    @Mock
    private NotificationService notificationService;

    @Mock
    private ApplicationEventPublisher eventPublisher;

    @Mock
    private TrainerAuthorizationService trainerAuthorizationService;

    @InjectMocks
    private MentorApplicationService service;

    @Test
    void submitSavesPendingApplicationWithCatalogAndCustomSkills() {
        ApidUserPrincipal actor = actor();
        User applicant = new User();
        applicant.setId(actor.getUserId());
        Skill skill = new Skill();
        skill.setId(12L);
        StoredFile proofFile = proofFile(actor.getUserId());
        MockMultipartFile upload = proofUpload();

        when(userRepository.findByIdForUpdate(actor.getUserId())).thenReturn(Optional.of(applicant));
        when(skillRepository.findByIdAndActiveTrue(12L)).thenReturn(Optional.of(skill));
        when(fileStorageService.store(upload, FilePurpose.TRAINER_CERT, actor))
                .thenReturn(fileDto(actor.getUserId()));
        when(storedFileRepository.findByIdAndDeletedFalse(31L)).thenReturn(Optional.of(proofFile));
        when(applicationRepository.save(any(MentorApplication.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        var result = service.submit(12L, "  Custom skill  ", "  Supporting note  ", upload, actor);

        ArgumentCaptor<MentorApplication> applicationCaptor = ArgumentCaptor.forClass(MentorApplication.class);
        verify(applicationRepository).save(applicationCaptor.capture());
        MentorApplication saved = applicationCaptor.getValue();
        assertEquals(MentorApplicationType.INITIAL, saved.getApplicationType());
        assertEquals(MentorApplicationStatus.PENDING, saved.getStatus());
        assertSame(applicant, saved.getApplicant());
        assertSame(proofFile, saved.getProofDocument());
        assertSame(skill, saved.getCatalogSkill());
        assertEquals("Custom skill", saved.getCustomSkill());
        assertEquals("Supporting note", saved.getNote());
        assertEquals(MentorApplicationStatus.PENDING, result.status());
        assertEquals(12L, result.catalogSkillId());
    }

    @Test
    void submitSavesMultipleCatalogSkillsAndEvidenceFiles() {
        ApidUserPrincipal actor = actor();
        User applicant = new User();
        applicant.setId(actor.getUserId());
        Skill firstSkill = new Skill();
        firstSkill.setId(12L);
        Skill secondSkill = new Skill();
        secondSkill.setId(13L);
        MockMultipartFile firstUpload = proofUpload();
        MockMultipartFile secondUpload = new MockMultipartFile(
                "supportingEvidence", "portfolio.pdf", "application/pdf", new byte[]{4, 5, 6}
        );
        StoredFile firstFile = proofFile(actor.getUserId());
        StoredFile secondFile = new StoredFile();
        secondFile.setId(32L);
        secondFile.setOriginalFilename("portfolio.pdf");
        secondFile.setUploadedByUserId(actor.getUserId());
        secondFile.setPurpose(FilePurpose.TRAINER_CERT);

        when(userRepository.findByIdForUpdate(actor.getUserId())).thenReturn(Optional.of(applicant));
        when(skillRepository.findByIdAndActiveTrue(12L)).thenReturn(Optional.of(firstSkill));
        when(skillRepository.findByIdAndActiveTrue(13L)).thenReturn(Optional.of(secondSkill));
        when(fileStorageService.store(firstUpload, FilePurpose.TRAINER_CERT, actor))
                .thenReturn(fileDto(actor.getUserId()));
        when(fileStorageService.store(secondUpload, FilePurpose.TRAINER_CERT, actor))
                .thenReturn(new StoredFileDto(
                        32L, "portfolio.pdf", "application/pdf", 3L, "hash2",
                        "MENTORING", FilePurpose.TRAINER_CERT, actor.getUserId(), Instant.now()
                ));
        when(storedFileRepository.findByIdAndDeletedFalse(31L)).thenReturn(Optional.of(firstFile));
        when(storedFileRepository.findByIdAndDeletedFalse(32L)).thenReturn(Optional.of(secondFile));
        when(applicationRepository.save(any(MentorApplication.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        var result = service.submit(
                List.of(12L, 13L),
                null,
                null,
                "Experienced mentor",
                "Weekdays",
                null,
                null,
                null,
                3,
                List.of(firstUpload, secondUpload),
                List.of("Curriculum vitae", "Education background 1"),
                actor
        );

        ArgumentCaptor<MentorApplication> applicationCaptor = ArgumentCaptor.forClass(MentorApplication.class);
        verify(applicationRepository).save(applicationCaptor.capture());
        MentorApplication saved = applicationCaptor.getValue();
        assertEquals(MentorApplicationType.INITIAL, saved.getApplicationType());
        assertEquals(Set.of(firstSkill, secondSkill), saved.getCatalogSkills());
        assertEquals(Set.of(firstFile, secondFile), saved.getSupportingEvidence());
        assertEquals(
                "31\tCurriculum vitae\n32\tEducation background 1",
                saved.getEvidenceContexts()
        );
        assertEquals(
                "Education background 1",
                MentorApplicationDto.from(saved).evidenceFiles().stream()
                        .filter(evidence -> evidence.fileId().equals(32L))
                        .findFirst()
                        .orElseThrow()
                        .context()
        );
        assertSame(firstFile, saved.getProofDocument());
        assertEquals(List.of(12L, 13L), result.catalogSkillIds());
    }

    @Test
    void submitRejectsApplicationWithoutCatalogOrCustomSkill() {
        ApidUserPrincipal actor = actor();

        assertThrows(
                BusinessException.class,
                () -> service.submit(null, "   ", null, proofUpload(), actor)
        );

        verifyNoInteractions(
                applicationRepository,
                userRepository,
                skillRepository,
                storedFileRepository,
                fileStorageService
        );
    }

    @Test
    void submitRejectsAnotherInitialApplicationWhileOneIsPendingOrApproved() {
        ApidUserPrincipal actor = actor();
        User applicant = user(actor.getUserId(), actor.getUsername());
        when(skillRepository.findByIdAndActiveTrue(12L)).thenReturn(Optional.of(new Skill()));
        when(userRepository.findByIdForUpdate(actor.getUserId())).thenReturn(Optional.of(applicant));
        when(applicationRepository.existsByApplicant_IdAndApplicationTypeAndStatusIn(
                actor.getUserId(),
                MentorApplicationType.INITIAL,
                List.of(MentorApplicationStatus.PENDING, MentorApplicationStatus.APPROVED)
        )).thenReturn(true);

        assertThrows(
                BusinessException.class,
                () -> service.submit(12L, null, null, proofUpload(), actor)
        );

        verifyNoInteractions(fileStorageService, storedFileRepository);
    }

    @Test
    void approvedMentorCanSubmitAnAdditionalSkillForHrReview() {
        ApidUserPrincipal actor = actor();
        User applicant = user(actor.getUserId(), actor.getUsername());
        Role mentorRole = new Role();
        mentorRole.setName("Mentor");
        UserRole activeMentorRole = new UserRole();
        activeMentorRole.setRole(mentorRole);
        Skill requestedSkill = new Skill();
        requestedSkill.setId(13L);
        MockMultipartFile upload = proofUpload();
        StoredFile proofFile = proofFile(actor.getUserId());

        when(userRepository.findByIdForUpdate(actor.getUserId())).thenReturn(Optional.of(applicant));
        when(userRoleRepository.findActiveByUserIdWithRole(actor.getUserId()))
                .thenReturn(List.of(activeMentorRole));
        when(trainerAuthorizationService.getOwnProfile(actor)).thenReturn(new TrainerRosterDto(
                1L,
                2L,
                actor.getUserId(),
                "EMP-7",
                "Mentor Applicant",
                "Finance",
                "ACTIVE",
                TrainerAuthorizationSource.APPLICATION,
                TrainerAuthorizationStatus.ACTIVE,
                true,
                0,
                0,
                3,
                null,
                null,
                List.of(),
                Instant.now(),
                Instant.now(),
                null,
                null,
                null,
                null,
                null,
                null,
                List.of()
        ));
        when(applicationRepository.findAllByApplicant_IdAndApplicationTypeAndStatus(
                actor.getUserId(),
                MentorApplicationType.SKILL_ADDITION,
                MentorApplicationStatus.PENDING
        )).thenReturn(List.of());
        when(skillRepository.findByIdAndActiveTrue(13L)).thenReturn(Optional.of(requestedSkill));
        when(fileStorageService.store(upload, FilePurpose.TRAINER_CERT, actor))
                .thenReturn(fileDto(actor.getUserId()));
        when(storedFileRepository.findByIdAndDeletedFalse(31L)).thenReturn(Optional.of(proofFile));
        when(applicationRepository.save(any(MentorApplication.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        var result = service.submitSkillAddition(
                List.of(13L),
                null,
                null,
                List.of(upload),
                actor
        );

        ArgumentCaptor<MentorApplication> applicationCaptor = ArgumentCaptor.forClass(MentorApplication.class);
        verify(applicationRepository).save(applicationCaptor.capture());
        assertEquals(MentorApplicationType.SKILL_ADDITION, applicationCaptor.getValue().getApplicationType());
        assertEquals(Set.of(requestedSkill), applicationCaptor.getValue().getCatalogSkills());
        assertEquals(MentorApplicationType.SKILL_ADDITION, result.applicationType());
    }

    @Test
    void listApplicationsReturnsStoredApplicantSkillAndProofDetails() {
        User applicant = new User();
        applicant.setUsername("mentor.applicant");
        Skill skill = new Skill();
        skill.setName("Financial Analysis");
        StoredFile proofFile = new StoredFile();
        proofFile.setOriginalFilename("financial-analysis.pdf");

        MentorApplication application = new MentorApplication();
        application.setApplicant(applicant);
        application.setCatalogSkill(skill);
        application.setProofDocument(proofFile);
        when(applicationRepository.findAllByOrderBySubmittedAtDesc()).thenReturn(List.of(application));

        var result = service.listApplications();

        assertEquals(1, result.size());
        assertEquals("mentor.applicant", result.get(0).applicantUsername());
        assertEquals("Financial Analysis", result.get(0).skillName());
        assertEquals("financial-analysis.pdf", result.get(0).proofFileName());
    }

    @Test
    void reviewApprovalAssignsMentorRoleAndCatalogSkill() {
        ApidUserPrincipal actor = actor();
        User applicant = user(11L, "applicant");
        User reviewer = user(actor.getUserId(), actor.getUsername());
        Skill skill = new Skill();
        skill.setId(12L);
        skill.setName("Financial Analysis");
        MentorApplication application = application(applicant, skill);
        Role mentorRole = new Role();
        mentorRole.setId(4L);
        mentorRole.setName("Mentor");

        when(applicationRepository.findByIdForUpdate(50L)).thenReturn(Optional.of(application));
        when(userRepository.findByIdForUpdate(11L)).thenReturn(Optional.of(applicant));
        when(userRepository.findById(actor.getUserId())).thenReturn(Optional.of(reviewer));
        when(userRepository.getReferenceById(actor.getUserId())).thenReturn(reviewer);
        when(roleRepository.findByNameIgnoreCase("Mentor")).thenReturn(Optional.of(mentorRole));
        when(userRoleRepository.findActiveByUserIdWithRole(11L)).thenReturn(List.of());
        when(applicationRepository.save(any(MentorApplication.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        var result = service.reviewApplication(
                50L,
                new MentorApplicationReviewRequest(MentorApplicationStatus.APPROVED, null),
                actor
        );

        ArgumentCaptor<UserRole> roleCaptor = ArgumentCaptor.forClass(UserRole.class);
        verify(userRoleRepository).save(roleCaptor.capture());
        assertSame(applicant, roleCaptor.getValue().getUser());
        assertSame(mentorRole, roleCaptor.getValue().getRole());
        assertSame(reviewer, roleCaptor.getValue().getAssignedBy());
        assertEquals(MentorApplicationStatus.APPROVED, result.status());
        assertEquals("Financial Analysis", result.skillName());
        assertEquals(MentorApplicationStatus.APPROVED, application.getStatus());
        assertEquals(1, applicant.getSkills().size());
        verify(notificationService).notify(
                11L,
                com.boa.apid.core.notifications.entity.NotificationModule.MENTORING,
                "MENTOR_APPLICATION_APPROVED",
                "Mentor application approved",
                "Your mentor application for Financial Analysis was approved.",
                "/mentoring?tab=applications"
        );
    }

    @Test
    void reviewApprovalAddsCustomSkillToSharedCatalogAndTrainerAuthorization() {
        ApidUserPrincipal actor = actor();
        User applicant = user(11L, "applicant");
        User reviewer = user(actor.getUserId(), actor.getUsername());
        MentorApplication application = application(applicant, null);
        application.setCustomSkill("Custom Coaching");
        Role mentorRole = new Role();
        mentorRole.setId(4L);
        mentorRole.setName("Mentor");

        when(applicationRepository.findByIdForUpdate(50L)).thenReturn(Optional.of(application));
        when(userRepository.findByIdForUpdate(11L)).thenReturn(Optional.of(applicant));
        when(userRepository.findById(actor.getUserId())).thenReturn(Optional.of(reviewer));
        when(userRepository.getReferenceById(actor.getUserId())).thenReturn(reviewer);
        when(roleRepository.findByNameIgnoreCase("Mentor")).thenReturn(Optional.of(mentorRole));
        when(userRoleRepository.findActiveByUserIdWithRole(11L)).thenReturn(List.of());
        when(skillRepository.findByNameIgnoreCase("Custom Coaching")).thenReturn(Optional.empty());
        when(skillRepository.save(any(Skill.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(applicationRepository.save(any(MentorApplication.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        var result = service.reviewApplication(
                50L,
                new MentorApplicationReviewRequest(MentorApplicationStatus.APPROVED, null),
                actor
        );

        Skill registeredSkill = application.getCatalogSkills().stream().findFirst().orElseThrow();
        assertEquals("Custom Coaching", registeredSkill.getName());
        assertEquals("Mentoring", registeredSkill.getCategory());
        assertEquals(Set.of(registeredSkill), applicant.getSkills());
        assertEquals("Custom Coaching", result.skillName());
        verify(eventPublisher).publishEvent(any(SkillCacheInvalidationEvent.class));
        verify(trainerAuthorizationService).authorizeApplication(application, reviewer);
    }

    @Test
    void approvingSkillAdditionExtendsMentorAuthorizationWithoutAssigningMentorRoleAgain() {
        ApidUserPrincipal actor = actor();
        User applicant = user(11L, "applicant");
        User reviewer = user(actor.getUserId(), actor.getUsername());
        Skill skill = new Skill();
        skill.setId(13L);
        skill.setName("Financial Modeling");
        MentorApplication application = application(applicant, skill);
        application.setApplicationType(MentorApplicationType.SKILL_ADDITION);
        Role mentorRole = new Role();
        mentorRole.setId(4L);
        mentorRole.setName("Mentor");
        UserRole activeMentorRole = new UserRole();
        activeMentorRole.setRole(mentorRole);

        when(applicationRepository.findByIdForUpdate(50L)).thenReturn(Optional.of(application));
        when(userRepository.findByIdForUpdate(11L)).thenReturn(Optional.of(applicant));
        when(userRepository.findById(actor.getUserId())).thenReturn(Optional.of(reviewer));
        when(roleRepository.findByNameIgnoreCase("Mentor")).thenReturn(Optional.of(mentorRole));
        when(userRoleRepository.findActiveByUserIdWithRole(11L)).thenReturn(List.of(activeMentorRole));
        when(applicationRepository.save(any(MentorApplication.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        var result = service.reviewApplication(
                50L,
                new MentorApplicationReviewRequest(MentorApplicationStatus.APPROVED, null),
                actor
        );

        assertEquals(MentorApplicationType.SKILL_ADDITION, result.applicationType());
        assertEquals(MentorApplicationStatus.APPROVED, result.status());
        verify(userRoleRepository, org.mockito.Mockito.never()).save(any(UserRole.class));
        verify(trainerAuthorizationService).authorizeApplication(application, reviewer);
        verify(notificationService).notify(
                11L,
                com.boa.apid.core.notifications.entity.NotificationModule.MENTORING,
                "MENTOR_SKILL_ADDITION_APPROVED",
                "Mentor skill request approved",
                "Your additional skill request for Financial Modeling was approved.",
                "/mentoring?tab=applications"
        );
    }

    @Test
    void submitProfileUpdateCreatesReviewRequestWithoutEvidence() {
        ApidUserPrincipal actor = actor();
        User applicant = user(actor.getUserId(), actor.getUsername());
        when(trainerAuthorizationService.getOwnProfile(actor)).thenReturn(new TrainerRosterDto(
                1L, 2L, actor.getUserId(), "EMP-7", "Mentor Applicant", "Finance", "ACTIVE",
                TrainerAuthorizationSource.APPLICATION, TrainerAuthorizationStatus.ACTIVE, true,
                0, 0, 3, null, null, List.of(), Instant.now(), Instant.now(),
                null, null, null, null, null, null, List.of()
        ));
        when(userRepository.findByIdForUpdate(actor.getUserId())).thenReturn(Optional.of(applicant));
        when(applicationRepository.findAllByApplicant_IdAndApplicationTypeAndStatus(
                actor.getUserId(),
                MentorApplicationType.PROFILE_UPDATE,
                MentorApplicationStatus.PENDING
        )).thenReturn(List.of());
        when(applicationRepository.save(any(MentorApplication.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        var result = service.submitProfileUpdate(
                new com.boa.apid.mentoring.trainer.dto.TrainerProfileRequest(
                        "A new mentoring approach", "Weekday evenings", 4, 8,
                        "A new mentoring approach", 2
                ),
                actor
        );

        ArgumentCaptor<MentorApplication> applicationCaptor = ArgumentCaptor.forClass(MentorApplication.class);
        verify(applicationRepository).save(applicationCaptor.capture());
        MentorApplication saved = applicationCaptor.getValue();
        assertEquals(MentorApplicationType.PROFILE_UPDATE, saved.getApplicationType());
        assertEquals(MentorApplicationStatus.PENDING, saved.getStatus());
        assertNull(saved.getProofDocument());
        assertEquals("A new mentoring approach", saved.getMentoringApproach());
        assertEquals("Weekday evenings", saved.getAvailabilityNotes());
        assertEquals(MentorApplicationType.PROFILE_UPDATE, result.applicationType());
    }

    @Test
    void approvingProfileUpdateDoesNotCreateMentorAuthorization() {
        ApidUserPrincipal actor = actor();
        User applicant = user(11L, "applicant");
        User reviewer = user(actor.getUserId(), actor.getUsername());
        MentorApplication application = application(applicant, null);
        application.setApplicationType(MentorApplicationType.PROFILE_UPDATE);
        application.setProofDocument(null);
        application.setMentoringApproach("Updated approach");

        when(applicationRepository.findByIdForUpdate(50L)).thenReturn(Optional.of(application));
        when(userRepository.findByIdForUpdate(11L)).thenReturn(Optional.of(applicant));
        when(userRepository.findById(actor.getUserId())).thenReturn(Optional.of(reviewer));
        when(applicationRepository.save(any(MentorApplication.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        var result = service.reviewApplication(
                50L,
                new MentorApplicationReviewRequest(MentorApplicationStatus.APPROVED, null),
                actor
        );

        assertEquals(MentorApplicationType.PROFILE_UPDATE, result.applicationType());
        verify(trainerAuthorizationService).approveProfileUpdate(application);
        verify(trainerAuthorizationService, org.mockito.Mockito.never())
                .authorizeApplication(any(MentorApplication.class), any(User.class));
        verify(userRoleRepository, org.mockito.Mockito.never()).save(any(UserRole.class));
    }

    @Test
    void reviewDeclineRequiresReasonAndNotifiesApplicant() {
        ApidUserPrincipal actor = actor();
        User applicant = user(11L, "applicant");
        User reviewer = user(actor.getUserId(), actor.getUsername());
        MentorApplication application = application(applicant, null);
        application.setCustomSkill("Coaching");

        when(applicationRepository.findByIdForUpdate(50L)).thenReturn(Optional.of(application));
        when(userRepository.findByIdForUpdate(11L)).thenReturn(Optional.of(applicant));
        when(userRepository.findById(actor.getUserId())).thenReturn(Optional.of(reviewer));
        when(applicationRepository.save(any(MentorApplication.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        var result = service.reviewApplication(
                50L,
                new MentorApplicationReviewRequest(MentorApplicationStatus.DECLINED, "Evidence is incomplete."),
                actor
        );

        assertEquals(MentorApplicationStatus.DECLINED, result.status());
        assertEquals("Evidence is incomplete.", result.reviewReason());
        assertEquals(actor.getUsername(), result.reviewedByUsername());
        verify(userRoleRepository, org.mockito.Mockito.never()).save(any(UserRole.class));
        verify(notificationService).notify(
                11L,
                com.boa.apid.core.notifications.entity.NotificationModule.MENTORING,
                "MENTOR_APPLICATION_DECLINED",
                "Mentor application declined",
                "Your mentor application for Coaching was declined. Reason: Evidence is incomplete.",
                "/mentoring?tab=applications"
        );
    }

    @Test
    void reviewDeclineWithoutReasonDoesNotLoadApplication() {
        assertThrows(
                BusinessException.class,
                () -> service.reviewApplication(
                        50L,
                        new MentorApplicationReviewRequest(MentorApplicationStatus.DECLINED, "  "),
                        actor()
                )
        );

        verifyNoInteractions(applicationRepository);
    }

    private static User user(Long id, String username) {
        User user = new User();
        user.setId(id);
        user.setUsername(username);
        return user;
    }

    private static MentorApplication application(User applicant, Skill skill) {
        StoredFile proofFile = new StoredFile();
        proofFile.setOriginalFilename("proof.pdf");
        MentorApplication application = new MentorApplication();
        application.setApplicant(applicant);
        application.setCatalogSkill(skill);
        application.setProofDocument(proofFile);
        return application;
    }

    private static ApidUserPrincipal actor() {
        return new ApidUserPrincipal(7L, "applicant", true, false, 1, Set.of(), Set.of());
    }

    private static MockMultipartFile proofUpload() {
        return new MockMultipartFile("proofDocument", "proof.pdf", "application/pdf", new byte[]{1, 2, 3});
    }

    private static StoredFile proofFile(Long uploadedByUserId) {
        StoredFile file = new StoredFile();
        file.setId(31L);
        file.setUploadedByUserId(uploadedByUserId);
        file.setPurpose(FilePurpose.TRAINER_CERT);
        return file;
    }

    private static StoredFileDto fileDto(Long uploadedByUserId) {
        return new StoredFileDto(
                31L,
                "proof.pdf",
                "application/pdf",
                3L,
                "hash",
                "MENTORING",
                FilePurpose.TRAINER_CERT,
                uploadedByUserId,
                Instant.now()
        );
    }
}
