package com.boa.apid.mentoring.application.service;

import com.boa.apid.common.exception.BusinessException;
import com.boa.apid.common.exception.ResourceNotFoundException;
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
import com.boa.apid.mentoring.application.dto.MentorApplicationDto;
import com.boa.apid.mentoring.application.dto.MentorApplicationSubmittedDto;
import com.boa.apid.mentoring.application.entity.MentorApplication;
import com.boa.apid.mentoring.application.repository.MentorApplicationRepository;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

@Service
public class MentorApplicationService {

    private final MentorApplicationRepository applicationRepository;
    private final UserRepository userRepository;
    private final SkillRepository skillRepository;
    private final StoredFileRepository storedFileRepository;
    private final FileStorageService fileStorageService;

    public MentorApplicationService(
            MentorApplicationRepository applicationRepository,
            UserRepository userRepository,
            SkillRepository skillRepository,
            StoredFileRepository storedFileRepository,
            FileStorageService fileStorageService
    ) {
        this.applicationRepository = applicationRepository;
        this.userRepository = userRepository;
        this.skillRepository = skillRepository;
        this.storedFileRepository = storedFileRepository;
        this.fileStorageService = fileStorageService;
    }

    @Transactional
    public MentorApplicationSubmittedDto submit(
            Long catalogSkillId,
            String customSkill,
            String note,
            MultipartFile proofDocument,
            ApidUserPrincipal actor
    ) {
        String normalizedCustomSkill = normalizeOptional(customSkill);
        if (catalogSkillId == null && normalizedCustomSkill == null) {
            throw new BusinessException(
                    "MENTOR_APPLICATION_SKILL_REQUIRED",
                    "Choose a catalog skill or enter a custom skill."
            );
        }
        if (normalizedCustomSkill != null && normalizedCustomSkill.length() > 150) {
            throw new BusinessException(
                    "MENTOR_APPLICATION_SKILL_TOO_LONG",
                    "Custom skill must be 150 characters or fewer."
            );
        }

        User applicant = userRepository.findById(actor.getUserId())
                .orElseThrow(() -> new ResourceNotFoundException("Applicant account not found"));
        Skill catalogSkill = catalogSkillId == null
                ? null
                : skillRepository.findByIdAndActiveTrue(catalogSkillId)
                        .orElseThrow(() -> new ResourceNotFoundException("Active catalog skill not found"));

        StoredFileDto uploadedFile = fileStorageService.store(proofDocument, FilePurpose.TRAINER_CERT, actor);
        StoredFile proofFile = storedFileRepository.findByIdAndDeletedFalse(uploadedFile.id())
                .orElseThrow(() -> new ResourceNotFoundException("Uploaded proof document not found"));
        if (!actor.getUserId().equals(proofFile.getUploadedByUserId())
                || proofFile.getPurpose() != FilePurpose.TRAINER_CERT) {
            throw new AccessDeniedException("Proof document must be uploaded by the applicant for this application");
        }

        MentorApplication application = new MentorApplication();
        application.setApplicant(applicant);
        application.setProofDocument(proofFile);
        application.setCatalogSkill(catalogSkill);
        application.setCustomSkill(normalizedCustomSkill);
        application.setNote(normalizeOptional(note));

        MentorApplication saved = applicationRepository.save(application);
        return new MentorApplicationSubmittedDto(
                saved.getId(),
                saved.getStatus(),
                catalogSkill == null ? null : catalogSkill.getId(),
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

    private String normalizeOptional(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        return value.trim();
    }
}
