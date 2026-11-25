package com.boa.apid.mentoring.ai.recommendation.service;

import com.boa.apid.mentoring.application.entity.MentorApplication;
import com.boa.apid.mentoring.trainer.dto.TrainerDirectoryDto;
import com.boa.apid.mentoring.trainer.dto.TrainerSkillDto;
import com.boa.apid.mentoring.trainer.entity.TrainerAuthorization;
import com.boa.apid.mentoring.trainer.entity.TrainerAuthorizationStatus;
import com.boa.apid.mentoring.trainer.repository.TrainerAuthorizationRepository;
import com.boa.apid.mentoring.trainer.service.TrainerAuthorizationService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class MentorRecommendationContextServiceTest {

    @Mock
    private TrainerAuthorizationService authorizationService;

    @Mock
    private TrainerAuthorizationRepository authorizationRepository;

    private MentorRecommendationContextService service;

    @BeforeEach
    void setUp() {
        service = new MentorRecommendationContextService(
                authorizationService,
                authorizationRepository,
                new ObjectMapper()
        );
    }

    @Test
    void loadsCompactStructuredFieldsFromTheApprovedMentorProfile() {
        TrainerDirectoryDto mentor = new TrainerDirectoryDto(
                20L,
                "mentor",
                "EMP-20",
                "Mentor Name",
                "Engineering",
                null,
                0,
                2,
                4.7,
                List.of(new TrainerSkillDto(
                        4L, "API Development", "Technical", TrainerAuthorizationStatus.ACTIVE, null
                )),
                8,
                null,
                2,
                List.of(new TrainerDirectoryDto.EducationProfile("Master's", "Computer Science", "Example U")),
                List.of(),
                List.of()
        );
        MentorApplication application = new MentorApplication();
        application.setNote("""
                General professional experience: [{"title":"Software Engineer","organization":"Example Co","years":"2018-2024"}]
                Previous mentorship experience: [{"role":"Volunteer Mentor","organization":"Example Org","years":"2021-2024"}]
                """);
        TrainerAuthorization authorization = new TrainerAuthorization();
        authorization.setSourceApplication(application);
        when(authorizationService.listDirectory(null, null)).thenReturn(List.of(mentor));
        when(authorizationRepository.findByUserIdAndStatus(20L, TrainerAuthorizationStatus.ACTIVE))
                .thenReturn(List.of(authorization));

        var candidates = service.loadCandidates(99L);

        assertEquals(1, candidates.size());
        var candidate = candidates.get(0);
        assertEquals("Software Engineer", candidate.careerExperience().get(0).role());
        assertEquals("Volunteer Mentor", candidate.mentorshipExperience().get(0).role());
        assertEquals("Master's", candidate.education().get(0).educationLevel());
        assertEquals("Computer Science", candidate.education().get(0).fieldOfStudy());
    }
}
