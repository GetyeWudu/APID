package com.boa.apid.mentoring.pairing.service;

import com.boa.apid.common.exception.BusinessException;
import com.boa.apid.core.auth.security.ApidUserPrincipal;
import com.boa.apid.core.authorization.entity.User;
import com.boa.apid.core.authorization.entity.UserStatus;
import com.boa.apid.core.authorization.repository.UserRepository;
import com.boa.apid.core.authorization.repository.UserRoleRepository;
import com.boa.apid.core.organization.entity.EmploymentStatus;
import com.boa.apid.core.organization.repository.EmployeeRepository;
import com.boa.apid.mentoring.pairing.dto.MentoringChatMessageRequest;
import com.boa.apid.mentoring.pairing.dto.MentoringSessionRequest;
import com.boa.apid.mentoring.pairing.entity.MentoringDeliveryMode;
import com.boa.apid.mentoring.pairing.entity.MentoringMessage;
import com.boa.apid.mentoring.pairing.entity.MentoringRelationship;
import com.boa.apid.mentoring.pairing.entity.MentoringRelationshipMemberStatus;
import com.boa.apid.mentoring.pairing.entity.MentoringRelationshipStatus;
import com.boa.apid.mentoring.pairing.entity.MentoringRequest;
import com.boa.apid.mentoring.pairing.entity.MentoringRequestType;
import com.boa.apid.mentoring.pairing.entity.MentoringSession;
import com.boa.apid.mentoring.pairing.repository.MentoringMessageRepository;
import com.boa.apid.mentoring.pairing.repository.MentoringRelationshipMemberRepository;
import com.boa.apid.mentoring.pairing.repository.MentoringRelationshipRepository;
import com.boa.apid.mentoring.pairing.repository.MentoringSessionRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.access.AccessDeniedException;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class MentoringCollaborationServiceTest {

    @Mock private MentoringRelationshipRepository relationshipRepository;
    @Mock private MentoringRelationshipMemberRepository memberRepository;
    @Mock private MentoringSessionRepository sessionRepository;
    @Mock private MentoringMessageRepository messageRepository;
    @Mock private EmployeeRepository employeeRepository;
    @Mock private UserRepository userRepository;
    @Mock private UserRoleRepository userRoleRepository;

    @InjectMocks
    private MentoringCollaborationService service;

    @Test
    void onlyTheMentorCanScheduleASession() {
        User mentor = user(1L, "mentor");
        MentoringRelationship relationship = relationship(mentor, MentoringRelationshipStatus.ACTIVE);
        when(relationshipRepository.findDetailedById(7L)).thenReturn(Optional.of(relationship));
        when(memberRepository.existsByRelationship_IdAndTraineeUser_Id(7L, 2L)).thenReturn(true);

        assertThrows(
                AccessDeniedException.class,
                () -> service.createSession(
                        7L,
                        sessionRequest(Instant.now().plusSeconds(3600), Instant.now().plusSeconds(7200)),
                        actor(2L, "trainee")
                )
        );

        verify(sessionRepository, never()).save(any(MentoringSession.class));
    }

    @Test
    void mentorCanScheduleASessionForAnActiveRelationship() {
        User mentor = user(1L, "mentor");
        MentoringRelationship relationship = relationship(mentor, MentoringRelationshipStatus.ACTIVE);
        when(relationshipRepository.findDetailedById(7L)).thenReturn(Optional.of(relationship));
        when(userRoleRepository.existsActiveMentorRoleByUserId(1L)).thenReturn(true);
        when(employeeRepository.existsByUserIdAndEmploymentStatus(1L, EmploymentStatus.ACTIVE)).thenReturn(true);
        when(sessionRepository.save(any(MentoringSession.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));
        when(employeeRepository.findDetailedByUserIdIn(any())).thenReturn(List.of());

        Instant start = Instant.now().plusSeconds(3600);
        Instant end = start.plusSeconds(3600);
        service.createSession(7L, sessionRequest(start, end), actor(1L, "mentor"));

        ArgumentCaptor<MentoringSession> captor = ArgumentCaptor.forClass(MentoringSession.class);
        verify(sessionRepository).save(captor.capture());
        assertEquals("Career goals", captor.getValue().getTitle());
        assertEquals(start, captor.getValue().getScheduledStart());
        assertEquals(MentoringDeliveryMode.ONLINE, captor.getValue().getDeliveryMode());
        assertEquals(1L, captor.getValue().getCreatedByUser().getId());
    }

    @Test
    void activeTraineeCanSendMessageToTheirSharedRelationshipChat() {
        User mentor = user(1L, "mentor");
        User trainee = user(2L, "trainee");
        MentoringRelationship relationship = relationship(mentor, MentoringRelationshipStatus.ACTIVE);
        when(relationshipRepository.findDetailedById(7L)).thenReturn(Optional.of(relationship));
        when(memberRepository.existsByRelationship_IdAndTraineeUser_Id(7L, 2L)).thenReturn(true);
        when(memberRepository.existsByRelationship_IdAndTraineeUser_IdAndStatus(
                7L, 2L, MentoringRelationshipMemberStatus.ACTIVE
        )).thenReturn(true);
        when(userRepository.findById(2L)).thenReturn(Optional.of(trainee));
        when(messageRepository.save(any(MentoringMessage.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));
        when(employeeRepository.findDetailedByUserIdIn(any())).thenReturn(List.of());

        service.sendMessage(7L, new MentoringChatMessageRequest("  Hello class  "), actor(2L, "trainee"));

        ArgumentCaptor<MentoringMessage> captor = ArgumentCaptor.forClass(MentoringMessage.class);
        verify(messageRepository).save(captor.capture());
        assertEquals("Hello class", captor.getValue().getBody());
        assertEquals(2L, captor.getValue().getSenderUser().getId());
    }

    @Test
    void closedRelationshipChatCannotAcceptNewMessages() {
        User mentor = user(1L, "mentor");
        MentoringRelationship relationship = relationship(mentor, MentoringRelationshipStatus.COMPLETED);
        when(relationshipRepository.findDetailedById(7L)).thenReturn(Optional.of(relationship));

        assertThrows(
                BusinessException.class,
                () -> service.sendMessage(7L, new MentoringChatMessageRequest("Hello"), actor(1L, "mentor"))
        );

        verify(messageRepository, never()).save(any(MentoringMessage.class));
    }

    private static MentoringSessionRequest sessionRequest(Instant start, Instant end) {
        return new MentoringSessionRequest(
                "Career goals",
                "Discuss a development plan",
                start,
                end,
                MentoringDeliveryMode.ONLINE,
                "https://meet.example.com/room"
        );
    }

    private static MentoringRelationship relationship(User mentor, MentoringRelationshipStatus status) {
        MentoringRequest request = new MentoringRequest();
        request.setId(70L);
        request.setMentorUser(mentor);
        request.setInitiatedByUser(mentor);
        request.setRequestType(MentoringRequestType.INDIVIDUAL);

        MentoringRelationship relationship = new MentoringRelationship();
        relationship.setRequest(request);
        relationship.setMentorUser(mentor);
        relationship.setStatus(status);
        return relationship;
    }

    private static User user(Long id, String username) {
        User user = new User();
        user.setId(id);
        user.setUsername(username);
        user.setStatus(UserStatus.ACTIVE);
        return user;
    }

    private static ApidUserPrincipal actor(Long userId, String username) {
        return new ApidUserPrincipal(userId, username, true, false, 1, Set.of("Employee"), Set.of());
    }
}
