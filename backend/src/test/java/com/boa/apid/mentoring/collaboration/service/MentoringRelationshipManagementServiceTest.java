package com.boa.apid.mentoring.collaboration.service;

import com.boa.apid.common.exception.ResourceNotFoundException;
import com.boa.apid.common.storage.FileStorageService;
import com.boa.apid.common.storage.StoredFileRepository;
import com.boa.apid.core.audit.service.AuditService;
import com.boa.apid.core.auth.security.ApidUserPrincipal;
import com.boa.apid.core.authorization.entity.User;
import com.boa.apid.core.authorization.repository.UserRepository;
import com.boa.apid.core.notifications.service.NotificationService;
import com.boa.apid.core.organization.repository.EmployeeRepository;
import com.boa.apid.mentoring.collaboration.dto.MentoringRelationshipStatusRequest;
import com.boa.apid.mentoring.collaboration.entity.MentoringResource;
import com.boa.apid.mentoring.pairing.entity.MentoringRelationship;
import com.boa.apid.mentoring.pairing.entity.MentoringRelationshipStatus;
import com.boa.apid.mentoring.pairing.entity.MentoringSession;
import com.boa.apid.mentoring.pairing.entity.MentoringSessionStatus;
import com.boa.apid.mentoring.pairing.repository.MentoringRelationshipMemberRepository;
import com.boa.apid.mentoring.pairing.repository.MentoringRelationshipRepository;
import com.boa.apid.mentoring.pairing.repository.MentoringSessionAttendeeRepository;
import com.boa.apid.mentoring.pairing.repository.MentoringSessionRepository;
import com.boa.apid.mentoring.collaboration.repository.MentoringProgressNoteRepository;
import com.boa.apid.mentoring.collaboration.repository.MentoringRelationshipFeedbackRepository;
import com.boa.apid.mentoring.collaboration.repository.MentoringResourceRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.List;
import java.util.Set;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class MentoringRelationshipManagementServiceTest {

    @Mock private MentoringRelationshipRepository relationshipRepository;
    @Mock private MentoringRelationshipMemberRepository memberRepository;
    @Mock private MentoringSessionRepository sessionRepository;
    @Mock private MentoringSessionAttendeeRepository sessionAttendeeRepository;
    @Mock private MentoringResourceRepository resourceRepository;
    @Mock private MentoringProgressNoteRepository progressNoteRepository;
    @Mock private MentoringRelationshipFeedbackRepository feedbackRepository;
    @Mock private EmployeeRepository employeeRepository;
    @Mock private UserRepository userRepository;
    @Mock private StoredFileRepository storedFileRepository;
    @Mock private FileStorageService fileStorageService;
    @Mock private NotificationService notificationService;
    @Mock private AuditService auditService;

    @InjectMocks
    private MentoringRelationshipManagementService service;

    @Test
    void cannotCompleteRelationshipWhileConfirmedSessionsRemain() {
        MentoringRelationship relationship = activeRelationship();
        when(relationshipRepository.findDetailedById(7L)).thenReturn(Optional.of(relationship));
        when(sessionRepository.countByRelationship_IdAndStatus(7L, MentoringSessionStatus.CONFIRMED))
                .thenReturn(1L);

        assertThrows(
                com.boa.apid.common.exception.BusinessException.class,
                () -> service.changeRelationshipStatus(
                        7L,
                        new MentoringRelationshipStatusRequest(
                                MentoringRelationshipStatus.COMPLETED,
                                "Objectives completed"
                        ),
                        mentorActor()
                )
        );

        assertEquals(MentoringRelationshipStatus.ACTIVE, relationship.getStatus());
        verify(relationshipRepository, never()).save(any(MentoringRelationship.class));
    }

    @Test
    void cancellationRemainsAvailableWhileConfirmedSessionsRemain() {
        MentoringRelationship relationship = activeRelationship();
        when(relationshipRepository.findDetailedById(7L)).thenReturn(Optional.of(relationship));
        when(memberRepository.findByRelationship_IdOrderByJoinedAtAsc(7L)).thenReturn(List.of());

        service.changeRelationshipStatus(
                7L,
                new MentoringRelationshipStatusRequest(
                        MentoringRelationshipStatus.CANCELLED,
                        "The mentoring arrangement is ending"
                ),
                mentorActor()
        );

        assertEquals(MentoringRelationshipStatus.CANCELLED, relationship.getStatus());
        verify(sessionRepository, never())
                .countByRelationship_IdAndStatus(7L, MentoringSessionStatus.CONFIRMED);
        verify(relationshipRepository).save(relationship);
    }

    @Test
    void groupAttendeeCanListResourcesForTheirSessionOutsideTheAnchorRelationship() {
        MentoringRelationship relationship = activeRelationship();
        MentoringSession session = new MentoringSession();
        ReflectionTestUtils.setField(session, "id", 22L);
        session.setRelationship(relationship);
        session.setCreatedByUser(relationship.getMentorUser());
        session.setGroupSession(true);

        when(sessionRepository.findById(22L)).thenReturn(Optional.of(session));
        when(sessionAttendeeRepository.existsBySession_IdAndMember_TraineeUser_Id(22L, 2L))
                .thenReturn(true);
        when(resourceRepository.findByRelationship_IdAndSession_IdOrderByCreatedAtDesc(7L, 22L))
                .thenReturn(List.of());

        assertEquals(List.of(), service.listSessionResources(7L, 22L, traineeActor()));

        verify(resourceRepository).findByRelationship_IdAndSession_IdOrderByCreatedAtDesc(7L, 22L);
    }

    @Test
    void nonAttendeeCannotListGroupSessionResources() {
        MentoringRelationship relationship = activeRelationship();
        MentoringSession session = new MentoringSession();
        ReflectionTestUtils.setField(session, "id", 22L);
        session.setRelationship(relationship);
        session.setCreatedByUser(relationship.getMentorUser());
        session.setGroupSession(true);

        when(sessionRepository.findById(22L)).thenReturn(Optional.of(session));
        when(sessionAttendeeRepository.existsBySession_IdAndMember_TraineeUser_Id(22L, 2L))
                .thenReturn(false);

        assertThrows(
                ResourceNotFoundException.class,
                () -> service.listSessionResources(7L, 22L, traineeActor())
        );

        verify(resourceRepository, never()).findByRelationship_IdAndSession_IdOrderByCreatedAtDesc(7L, 22L);
    }

    @Test
    void groupSessionMentorCanShareAResource() {
        MentoringRelationship relationship = activeRelationship();
        relationship.getMentorUser().setUsername("mentor");
        MentoringSession session = new MentoringSession();
        ReflectionTestUtils.setField(session, "id", 22L);
        session.setRelationship(relationship);
        session.setCreatedByUser(relationship.getMentorUser());
        session.setGroupSession(true);

        when(sessionRepository.findById(22L)).thenReturn(Optional.of(session));
        when(userRepository.findById(1L)).thenReturn(Optional.of(relationship.getMentorUser()));
        when(resourceRepository.save(any(MentoringResource.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        var result = service.addSessionResource(
                7L,
                22L,
                "Workshop notes",
                "https://example.com/workshop-notes",
                null,
                mentorActor()
        );

        assertEquals(22L, result.sessionId());
        assertEquals("Workshop notes", result.title());
        verify(resourceRepository).save(any(MentoringResource.class));
    }

    private MentoringRelationship activeRelationship() {
        User mentor = new User();
        mentor.setId(1L);
        MentoringRelationship relationship = new MentoringRelationship();
        ReflectionTestUtils.setField(relationship, "id", 7L);
        relationship.setMentorUser(mentor);
        relationship.setStatus(MentoringRelationshipStatus.ACTIVE);
        return relationship;
    }

    private ApidUserPrincipal mentorActor() {
        return new ApidUserPrincipal(1L, "mentor", true, false, 0, Set.of("MENTOR"), Set.of());
    }

    private ApidUserPrincipal traineeActor() {
        return new ApidUserPrincipal(2L, "trainee", true, false, 0, Set.of("Employee"), Set.of());
    }
}
