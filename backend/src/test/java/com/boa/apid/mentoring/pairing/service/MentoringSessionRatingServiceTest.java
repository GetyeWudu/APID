package com.boa.apid.mentoring.pairing.service;

import com.boa.apid.core.authorization.entity.User;
import com.boa.apid.core.authorization.repository.UserRepository;
import com.boa.apid.core.authorization.repository.UserRoleRepository;
import com.boa.apid.mentoring.pairing.dto.MentoringSessionRatingRequest;
import com.boa.apid.mentoring.pairing.entity.MentoringRelationship;
import com.boa.apid.mentoring.pairing.entity.MentoringSession;
import com.boa.apid.mentoring.pairing.entity.MentoringSessionRating;
import com.boa.apid.mentoring.pairing.entity.MentoringSessionStatus;
import com.boa.apid.mentoring.pairing.repository.MentoringRelationshipMemberRepository;
import com.boa.apid.mentoring.pairing.repository.MentoringSessionAttendeeRepository;
import com.boa.apid.mentoring.pairing.repository.MentoringSessionRatingRepository;
import com.boa.apid.mentoring.pairing.repository.MentoringSessionRepository;
import com.boa.apid.mentoring.trainer.repository.TrainerAuthorizationRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.Instant;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class MentoringSessionRatingServiceTest {

    @Mock private MentoringSessionRepository sessionRepository;
    @Mock private MentoringSessionRatingRepository ratingRepository;
    @Mock private MentoringRelationshipMemberRepository memberRepository;
    @Mock private MentoringSessionAttendeeRepository sessionAttendeeRepository;
    @Mock private TrainerAuthorizationRepository authorizationRepository;
    @Mock private UserRoleRepository userRoleRepository;
    @Mock private UserRepository userRepository;

    @InjectMocks
    private MentoringSessionRatingService service;

    @Test
    void invitedGroupParticipantCanRateAnEndedGroupSession() {
        MentoringSession session = groupSession();
        User trainee = user(2L, "trainee");
        when(sessionRepository.findByIdForUpdate(11L)).thenReturn(Optional.of(session));
        when(sessionAttendeeRepository.existsBySession_IdAndMember_TraineeUser_Id(11L, 2L))
                .thenReturn(true);
        when(ratingRepository.findBySession_IdAndMenteeUser_Id(11L, 2L)).thenReturn(Optional.empty());
        when(userRepository.getReferenceById(2L)).thenReturn(trainee);
        when(ratingRepository.save(any(MentoringSessionRating.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        var result = service.rateSession(7L, 11L, new MentoringSessionRatingRequest(4), 2L);

        assertEquals(4, result.rating());
        ArgumentCaptor<MentoringSessionRating> ratingCaptor =
                ArgumentCaptor.forClass(MentoringSessionRating.class);
        verify(ratingRepository).save(ratingCaptor.capture());
        assertEquals(2L, ratingCaptor.getValue().getMenteeUser().getId());
        verify(memberRepository, never()).existsByRelationship_IdAndTraineeUser_Id(7L, 2L);
    }

    @Test
    void nonAttendeeCannotRateAGroupSession() {
        MentoringSession session = groupSession();
        when(sessionRepository.findByIdForUpdate(11L)).thenReturn(Optional.of(session));
        when(sessionAttendeeRepository.existsBySession_IdAndMember_TraineeUser_Id(11L, 2L))
                .thenReturn(false);

        assertThrows(
                AccessDeniedException.class,
                () -> service.rateSession(7L, 11L, new MentoringSessionRatingRequest(4), 2L)
        );

        verify(ratingRepository, never()).save(any(MentoringSessionRating.class));
    }

    private static MentoringSession groupSession() {
        User mentor = user(1L, "mentor");
        MentoringRelationship relationship = new MentoringRelationship();
        ReflectionTestUtils.setField(relationship, "id", 7L);
        MentoringSession session = new MentoringSession();
        ReflectionTestUtils.setField(session, "id", 11L);
        session.setRelationship(relationship);
        session.setCreatedByUser(mentor);
        session.setGroupSession(true);
        session.setStatus(MentoringSessionStatus.SCHEDULED);
        session.setScheduledEnd(Instant.now().minusSeconds(60));
        return session;
    }

    private static User user(Long id, String username) {
        User user = new User();
        user.setId(id);
        user.setUsername(username);
        return user;
    }
}
