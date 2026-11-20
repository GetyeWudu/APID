package com.boa.apid.mentoring.ai.recommendation.service;

import com.boa.apid.common.exception.BusinessException;
import com.boa.apid.mentoring.ai.client.MentoringAiClient;
import com.boa.apid.mentoring.ai.recommendation.dto.MentorRecommendationRequest;
import com.boa.apid.mentoring.trainer.dto.TrainerDirectoryDto;
import com.boa.apid.mentoring.trainer.dto.TrainerSkillDto;
import com.boa.apid.mentoring.trainer.entity.TrainerAuthorizationStatus;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class MentorRecommendationServiceTest {

    @Mock
    private MentorRecommendationContextService contextService;

    @Mock
    private MentoringAiClient ollamaClient;

    private MentorRecommendationService service;

    @BeforeEach
    void setUp() {
        service = new MentorRecommendationService(contextService, ollamaClient, new ObjectMapper());
    }

    @Test
    void mapsValidatedModelRankingToDatabaseMentorDetails() {
        TrainerDirectoryDto mentor = mentor();
        when(contextService.loadCandidates(7L)).thenReturn(List.of(
                new MentorRecommendationContextService.MentorCandidateContext(mentor, "profile")
        ));
        when(ollamaClient.recommend(anyString(), anyList(), anyList())).thenReturn("""
                {"recommendations":[{"mentorUserId":20,"rank":1,"reason":"Strong match","skillId":4}]}
                """);

        var result = service.recommend(new MentorRecommendationRequest("Learn APIs"), 7L);

        assertEquals(1, result.recommendations().size());
        assertEquals(20L, result.recommendations().get(0).mentor().userId());
        assertEquals("API Development", result.recommendations().get(0).skillName());
    }

    @Test
    void rejectsModelRecommendationsForUnknownMentors() {
        when(contextService.loadCandidates(7L)).thenReturn(List.of(
                new MentorRecommendationContextService.MentorCandidateContext(mentor(), "profile")
        ));
        when(ollamaClient.recommend(anyString(), anyList(), anyList())).thenReturn("""
                {"recommendations":[{"mentorUserId":999,"rank":1,"reason":"Unknown candidate","skillId":4}]}
                """);

        assertThrows(
                BusinessException.class,
                () -> service.recommend(new MentorRecommendationRequest("Learn APIs"), 7L)
        );
    }

    @Test
    void rejectsModelRecommendationsForSkillsTheMentorDoesNotHave() {
        when(contextService.loadCandidates(7L)).thenReturn(List.of(
                new MentorRecommendationContextService.MentorCandidateContext(mentor(), "profile")
        ));
        when(ollamaClient.recommend(anyString(), anyList(), anyList())).thenReturn("""
                {"recommendations":[{"mentorUserId":20,"rank":1,"reason":"Strong match","skillId":999}]}
                """);

        assertThrows(
                BusinessException.class,
                () -> service.recommend(new MentorRecommendationRequest("Learn APIs"), 7L)
        );
    }

    @Test
    void returnsAnEmptyModelResponseWithoutFallbackRecommendations() {
        when(contextService.loadCandidates(7L)).thenReturn(List.of(
                new MentorRecommendationContextService.MentorCandidateContext(mentor(), "profile")
        ));
        when(ollamaClient.recommend(anyString(), anyList(), anyList()))
                .thenReturn("{\"recommendations\":[]}");

        var result = service.recommend(new MentorRecommendationRequest("Learn marine biology"), 7L);

        assertTrue(result.recommendations().isEmpty());
    }

    private TrainerDirectoryDto mentor() {
        return new TrainerDirectoryDto(
                20L,
                "mentor",
                "EMP-20",
                "Mentor Name",
                "Engineering",
                null,
                0,
                2,
                4.5,
                List.of(new TrainerSkillDto(
                        4L, "API Development", "Technical", TrainerAuthorizationStatus.ACTIVE, null
                )),
                5,
                "Hands-on",
                2,
                List.of(),
                List.of()
        );
    }
}
