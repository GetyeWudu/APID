package com.boa.apid.mentoring.application.service;

import com.boa.apid.common.exception.BusinessException;
import com.boa.apid.common.storage.FilePurpose;
import com.boa.apid.common.storage.FileStorageService;
import com.boa.apid.common.storage.StoredFile;
import com.boa.apid.common.storage.StoredFileDto;
import com.boa.apid.common.storage.StoredFileRepository;
import com.boa.apid.core.auth.security.ApidUserPrincipal;
import com.boa.apid.core.authorization.entity.User;
import com.boa.apid.core.authorization.repository.UserRepository;
import com.boa.apid.core.skills.entity.Skill;
import com.boa.apid.core.skills.repository.SkillRepository;
import com.boa.apid.mentoring.application.entity.MentorApplication;
import com.boa.apid.mentoring.application.entity.MentorApplicationStatus;
import com.boa.apid.mentoring.application.repository.MentorApplicationRepository;
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

        when(userRepository.findById(actor.getUserId())).thenReturn(Optional.of(applicant));
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
