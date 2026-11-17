package com.boa.apid.mentoring.collaboration.service;

import com.boa.apid.common.storage.FileStorageService;
import com.boa.apid.common.storage.StoredFileRepository;
import com.boa.apid.core.audit.service.AuditService;
import com.boa.apid.core.auth.security.ApidUserPrincipal;
import com.boa.apid.core.authorization.entity.User;
import com.boa.apid.core.authorization.repository.UserRepository;
import com.boa.apid.core.notifications.service.NotificationService;
import com.boa.apid.core.organization.repository.EmployeeRepository;
import com.boa.apid.mentoring.collaboration.dto.MentoringRelationshipStatusRequest;
import com.boa.apid.mentoring.pairing.entity.MentoringRelationship;
import com.boa.apid.mentoring.pairing.entity.MentoringRelationshipStatus;
import com.boa.apid.mentoring.pairing.entity.MentoringSessionStatus;
import com.boa.apid.mentoring.pairing.repository.MentoringRelationshipMemberRepository;
import com.boa.apid.mentoring.pairing.repository.MentoringRelationshipRepository;
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
}
