package com.boa.apid.mentoring.ai.recommendation.service;

import com.boa.apid.mentoring.ai.client.MentoringAiClient;
import com.boa.apid.mentoring.ai.recommendation.dto.HrMentorRecommendationRequest;
import com.boa.apid.mentoring.ai.recommendation.dto.MentorRecommendationRequest;
import com.boa.apid.mentoring.trainer.dto.TrainerDirectoryDto;
import com.boa.apid.mentoring.trainer.dto.TrainerSkillDto;
import com.boa.apid.mentoring.trainer.entity.TrainerAuthorizationStatus;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
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
                new MentorRecommendationContextService.MentorCandidateContext(
                        mentor, List.of(), List.of(), List.of()
                )
        ));
        when(ollamaClient.recommend(anyString(), anyList(), anyList())).thenReturn("""
                {"overallReason":"Mentor ID 20 is a strong match for skill ID 4.","recommendations":[{"mentorUserId":20,"rank":1,"reason":"Mentor ID 20 strongly matches skill ID 4.","skillId":4,"rankingFactors":{"careerExperience":80,"mentorshipExperience":75,"educationRelevance":70,"rating":4.5}}]}
                """);

        var result = service.recommend(new MentorRecommendationRequest("Learn APIs"), 7L);

        assertEquals(1, result.recommendations().size());
        assertEquals("Mentor Name is a strong match for API Development.", result.overallReason());
        assertEquals(20L, result.recommendations().get(0).mentor().userId());
        assertEquals("API Development", result.recommendations().get(0).skillName());
        assertEquals(
                "Mentor Name strongly matches API Development.",
                result.recommendations().get(0).reason()
        );
    }

    @Test
    void sendsTheSavedProfileSummaryInsteadOfDetailedExperienceLists() throws Exception {
        TrainerDirectoryDto mentor = mentor();
        when(contextService.loadCandidates(7L)).thenReturn(List.of(
                new MentorRecommendationContextService.MentorCandidateContext(
                        mentor,
                        "A software engineer with career and volunteer mentoring experience, and a master's in computer science.",
                        List.of(new MentorRecommendationContextService.ExperienceContext(
                                "Software Engineer", "Example Co", "2018-2024"
                        )),
                        List.of(new MentorRecommendationContextService.ExperienceContext(
                                "Volunteer Mentor", "Example Org", "2021-2024"
                        )),
                        List.of(new MentorRecommendationContextService.EducationContext(
                                "Master's", "Computer Science"
                        ))
                )
        ));
        when(ollamaClient.recommend(anyString(), anyList(), anyList()))
                .thenReturn("{\"recommendations\":[]}");

        service.recommend(new MentorRecommendationRequest("Learn APIs"), 7L);

        ArgumentCaptor<String> promptCaptor = ArgumentCaptor.forClass(String.class);
        verify(ollamaClient).recommend(promptCaptor.capture(), anyList(), anyList());
        JsonNode prompt = new ObjectMapper().readTree(promptCaptor.getValue());
        JsonNode candidate = prompt.path("candidates").get(0);
        assertEquals("Learn APIs", prompt.path("learningGoal").asText());
        assertEquals(20L, candidate.path("mentorUserId").asLong());
        assertEquals("Mentor Name", candidate.path("mentorName").asText());
        assertEquals(4L, candidate.path("skills").get(0).path("skillId").asLong());
        assertEquals("API Development", candidate.path("skills").get(0).path("name").asText());
        assertEquals(
                "A software engineer with career and volunteer mentoring experience, and a master's in computer science.",
                candidate.path("profileSummary").asText()
        );
        assertTrue(candidate.path("careerExperience").isMissingNode());
        assertTrue(candidate.path("mentorshipExperience").isMissingNode());
        assertTrue(candidate.path("education").isMissingNode());
        assertEquals(4.5, candidate.path("rating").asDouble(), 0.001);
    }

    @Test
    void sendsNullProfileSummaryWhenAnExistingMentorHasNoSavedSummary() throws Exception {
        when(contextService.loadCandidates(7L)).thenReturn(List.of(
                new MentorRecommendationContextService.MentorCandidateContext(
                        mentor(), null, List.of(), List.of(), List.of()
                )
        ));
        when(ollamaClient.recommend(anyString(), anyList(), anyList()))
                .thenReturn("{\"recommendations\":[]}");

        service.recommend(new MentorRecommendationRequest("Learn APIs"), 7L);

        ArgumentCaptor<String> promptCaptor = ArgumentCaptor.forClass(String.class);
        verify(ollamaClient).recommend(promptCaptor.capture(), anyList(), anyList());
        JsonNode candidate = new ObjectMapper().readTree(promptCaptor.getValue())
                .path("candidates").get(0);
        assertTrue(candidate.path("profileSummary").isNull());
    }

    @Test
    void ignoresModelRecommendationsForUnknownMentors() {
        when(contextService.loadCandidates(7L)).thenReturn(List.of(
                new MentorRecommendationContextService.MentorCandidateContext(mentor(), List.of(), List.of(), List.of())
        ));
        when(ollamaClient.recommend(anyString(), anyList(), anyList())).thenReturn("""
                {"recommendations":[{"mentorUserId":999,"rank":1,"reason":"Unknown candidate","skillId":4,"rankingFactors":{"careerExperience":80,"mentorshipExperience":75,"educationRelevance":70,"rating":4.5}}]}
                """);

        var result = service.recommend(new MentorRecommendationRequest("Learn APIs"), 7L);
        assertTrue(result.recommendations().isEmpty());
    }

    @Test
    void ignoresModelRecommendationsForSkillsTheMentorDoesNotHave() {
        when(contextService.loadCandidates(7L)).thenReturn(List.of(
                new MentorRecommendationContextService.MentorCandidateContext(mentor(), List.of(), List.of(), List.of())
        ));
        when(ollamaClient.recommend(anyString(), anyList(), anyList())).thenReturn("""
                {"recommendations":[{"mentorUserId":20,"rank":1,"reason":"Strong match","skillId":999,"rankingFactors":{"careerExperience":80,"mentorshipExperience":75,"educationRelevance":70,"rating":4.5}}]}
                """);

        var result = service.recommend(new MentorRecommendationRequest("Learn APIs"), 7L);
        assertTrue(result.recommendations().isEmpty());
    }

    @Test
    void returnsNoRecommendationsWhenTheModelReturnsNoCandidates() {
        when(contextService.loadCandidates(7L)).thenReturn(List.of(
                new MentorRecommendationContextService.MentorCandidateContext(mentor(), List.of(), List.of(), List.of())
        ));
        when(ollamaClient.recommend(anyString(), anyList(), anyList()))
                .thenReturn("{\"recommendations\":[]}");

        var result = service.recommend(
                new MentorRecommendationRequest("I want to learn how to build APIs"),
                7L
        );
        assertTrue(result.recommendations().isEmpty());
    }

    @Test
    void returnsNoRecommendationsWhenModelFindsNoMatchForGoal() {
        when(contextService.loadCandidates(7L)).thenReturn(List.of(
                new MentorRecommendationContextService.MentorCandidateContext(mentor(), List.of(), List.of(), List.of())
        ));
        when(ollamaClient.recommend(anyString(), anyList(), anyList()))
                .thenReturn("{\"recommendations\":[]}");

        var result = service.recommend(new MentorRecommendationRequest("Learn marine biology"), 7L);

        assertTrue(result.recommendations().isEmpty());
    }

    @Test
    void letsTheModelRecommendTheMatchingMobileMentorForAFlutterGoal() {
        TrainerDirectoryDto mobileMentor = mobileMentor();
        TrainerDirectoryDto careerMentor = careerMentor();
        when(contextService.loadCandidates(7L)).thenReturn(List.of(
                new MentorRecommendationContextService.MentorCandidateContext(
                        careerMentor, List.of(), List.of(), List.of()
                ),
                new MentorRecommendationContextService.MentorCandidateContext(
                        mobileMentor, List.of(), List.of(), List.of()
                )
        ));
        when(ollamaClient.recommend(anyString(), anyList(), anyList())).thenReturn("""
                {"recommendations":[{"mentorUserId":20,"rank":1,"reason":"Flutter and mobile application experience","skillId":6,"rankingFactors":{"careerExperience":80,"mentorshipExperience":75,"educationRelevance":70,"rating":4.8}}]}
                """);

        var result = service.recommend(
                new MentorRecommendationRequest("mobile application with flutter"),
                7L
        );

        assertEquals(1, result.recommendations().size());
        assertEquals(20L, result.recommendations().get(0).mentor().userId());
        assertEquals("Mobile Application Development",
                result.recommendations().get(0).skillName());
        verify(ollamaClient).recommend(anyString(), eq(List.of(21L, 20L)), eq(List.of(5L, 6L)));
    }

    @Test
    void returnsModelRecommendationsRegardlessOfRankingFactorScores() {
        TrainerDirectoryDto unrelatedMentor = careerMentor();
        when(contextService.loadCandidates(7L)).thenReturn(List.of(
                new MentorRecommendationContextService.MentorCandidateContext(
                        unrelatedMentor,
                        List.of(),
                        List.of(),
                        List.of()
                )
        ));
        when(ollamaClient.recommend(anyString(), anyList(), anyList())).thenReturn("""
                {"recommendations":[{"mentorUserId":21,"rank":1,"reason":"Supports professional growth","skillId":5,"rankingFactors":{"careerExperience":40,"mentorshipExperience":30,"educationRelevance":35,"rating":4.9}}]}
                """);

        var result = service.recommend(
                new MentorRecommendationRequest("I want to grow into a technical leadership role"),
                7L
        );

        assertEquals(1, result.recommendations().size());
        assertEquals(21L, result.recommendations().get(0).mentor().userId());
    }

    @Test
    void doesNotRequireSupportingEvidenceQuotesFromTheModel() {
        when(contextService.loadCandidates(7L)).thenReturn(List.of(
                new MentorRecommendationContextService.MentorCandidateContext(
                        mentor(), List.of(), List.of(), List.of()
                )
        ));
        when(ollamaClient.recommend(anyString(), anyList(), anyList())).thenReturn("""
                {"recommendations":[{"mentorUserId":20,"rank":1,"reason":"Technical match","skillId":4,"rankingFactors":{"careerExperience":80,"mentorshipExperience":75,"educationRelevance":70,"rating":4.5}}]}
                """);

        var result = service.recommend(new MentorRecommendationRequest("Technical leadership"), 7L);

        assertEquals(1, result.recommendations().size());
        assertEquals(20L, result.recommendations().get(0).mentor().userId());
    }

    @Test
    void acceptsStructuredRecommendationWithoutUsingRankingScoresAsEligibilityFilters() {
        when(contextService.loadCandidates(7L)).thenReturn(List.of(
                new MentorRecommendationContextService.MentorCandidateContext(
                        mentor(), List.of(), List.of(), List.of()
                )
        ));
        when(ollamaClient.recommend(anyString(), anyList(), anyList())).thenReturn("""
                {"recommendations":[{"mentorUserId":20,"rank":1,"reason":"API experience matches the goal","skillId":4,"rankingFactors":{"careerExperience":90,"mentorshipExperience":85,"educationRelevance":80,"rating":4.5}}]}
                """);

        var result = service.recommend(new MentorRecommendationRequest("Learn APIs"), 7L);

        assertEquals(1, result.recommendations().size());
        assertEquals(20L, result.recommendations().get(0).mentor().userId());
        assertEquals(4L, result.recommendations().get(0).skillId());
    }

    @Test
    void hrRecommendationsOnlyPassMentorsWithTheExactRequestedSkillToTheModel() {
        when(contextService.loadCandidatesForSkill(7L, 4L)).thenReturn(List.of(
                new MentorRecommendationContextService.MentorCandidateContext(
                        mentor(), List.of(), List.of(), List.of()
                ),
                new MentorRecommendationContextService.MentorCandidateContext(
                        mobileMentor(), List.of(), List.of(), List.of()
                )
        ));
        when(ollamaClient.recommendExactSkill(anyString(), anyList(), anyList())).thenReturn("""
                {"overallReason":"Mentor Name has the requested API Development skill.","recommendations":[{"mentorUserId":20,"rank":1,"reason":"Mentor Name has API Development experience.","skillId":4,"rankingFactors":{"careerExperience":80,"mentorshipExperience":75,"educationRelevance":70,"rating":4.5}}]}
                """);

        var result = service.recommendForHrMatch(
                new HrMentorRecommendationRequest("Learn APIs", 4L),
                7L
        );

        assertEquals(1, result.recommendations().size());
        assertEquals(20L, result.recommendations().get(0).mentor().userId());
        verify(ollamaClient).recommendExactSkill(anyString(), eq(List.of(20L)), eq(List.of(4L)));
    }

    private TrainerDirectoryDto mentor() {
        return new TrainerDirectoryDto(
                20L,
                "mentor",
                "EMP-20",
                "Mentor Name",
                "Engineering",
                "Skills: API Development (Technical)",
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
                List.of(),
                List.of()
        );
    }

    private TrainerDirectoryDto mobileMentor() {
        return new TrainerDirectoryDto(
                20L,
                "mobile.mentor",
                "EMP-20",
                "Mobile Mentor",
                "Engineering",
                "Flutter and mobile application development",
                0,
                3,
                4.8,
                List.of(new TrainerSkillDto(
                        6L, "Mobile Application Development", "Software Engineering & IT",
                        TrainerAuthorizationStatus.ACTIVE, null
                )),
                6,
                "Hands-on",
                3,
                List.of(),
                List.of(),
                List.of()
        );
    }

    private TrainerDirectoryDto careerMentor() {
        return new TrainerDirectoryDto(
                21L,
                "career.mentor",
                "EMP-21",
                "Career Mentor",
                "Human Resources",
                "Career Development",
                0,
                3,
                4.9,
                List.of(new TrainerSkillDto(
                        5L, "Career Development", "Business & Management",
                        TrainerAuthorizationStatus.ACTIVE, null
                )),
                8,
                "Professional growth",
                2,
                List.of(),
                List.of(),
                List.of()
        );
    }
}
