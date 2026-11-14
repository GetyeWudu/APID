package com.boa.apid.mentoring.pairing.service;

import com.boa.apid.common.exception.BusinessException;
import com.boa.apid.core.auth.security.ApidUserPrincipal;
import com.boa.apid.core.authorization.entity.User;
import com.boa.apid.core.authorization.entity.UserStatus;
import com.boa.apid.core.authorization.repository.UserRepository;
import com.boa.apid.core.authorization.repository.UserRoleRepository;
import com.boa.apid.core.config.service.CoreConfigService;
import com.boa.apid.core.notifications.entity.NotificationModule;
import com.boa.apid.core.notifications.service.NotificationService;
import com.boa.apid.core.organization.entity.Employee;
import com.boa.apid.core.organization.entity.EmploymentStatus;
import com.boa.apid.core.organization.repository.EmployeeRepository;
import com.boa.apid.mentoring.pairing.dto.MentorInvitationRequest;
import com.boa.apid.mentoring.pairing.dto.MentoringRelationshipPairDto;
import com.boa.apid.mentoring.pairing.dto.MentoringRequestDecision;
import com.boa.apid.mentoring.pairing.entity.MentoringRelationship;
import com.boa.apid.mentoring.pairing.entity.MentoringRelationshipMember;
import com.boa.apid.mentoring.pairing.entity.MentoringRelationshipMemberStatus;
import com.boa.apid.mentoring.pairing.entity.MentoringRelationshipStatus;
import com.boa.apid.mentoring.pairing.entity.MentoringRequest;
import com.boa.apid.mentoring.pairing.entity.MentoringRequestRecipient;
import com.boa.apid.mentoring.pairing.entity.MentoringRequestRecipientStatus;
import com.boa.apid.mentoring.pairing.entity.MentoringRequestType;
import com.boa.apid.mentoring.pairing.repository.MentoringRelationshipRepository;
import com.boa.apid.mentoring.pairing.repository.MentoringRelationshipMemberRepository;
import com.boa.apid.mentoring.pairing.repository.MentoringRequestRecipientRepository;
import com.boa.apid.mentoring.pairing.repository.MentoringRequestRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.access.AccessDeniedException;

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
class MentoringPairingServiceTest {

    @Mock private MentoringRequestRepository requestRepository;
    @Mock private MentoringRequestRecipientRepository recipientRepository;
    @Mock private MentoringRelationshipRepository relationshipRepository;
    @Mock private MentoringRelationshipMemberRepository relationshipMemberRepository;
    @Mock private UserRepository userRepository;
    @Mock private UserRoleRepository userRoleRepository;
    @Mock private EmployeeRepository employeeRepository;
    @Mock private CoreConfigService coreConfigService;
    @Mock private NotificationService notificationService;

    @InjectMocks
    private MentoringPairingService service;

    @Test
    void listsRelationshipsWhereTheCurrentUserIsEitherMentorOrTrainee() {
        User currentUser = user(1L, "current.user");
        User trainee = user(2L, "trainee");
        User mentor = user(3L, "mentor");

        MentoringRelationship mentorRelationship = relationship(
                request(currentUser, currentUser, MentoringRequestType.INDIVIDUAL),
                currentUser,
                MentoringRelationshipStatus.ACTIVE
        );
        MentoringRelationshipMember traineeMembership = member(mentorRelationship, currentUser, trainee);

        MentoringRelationship traineeRelationship = relationship(
                request(mentor, mentor, MentoringRequestType.INDIVIDUAL),
                mentor,
                MentoringRelationshipStatus.COMPLETED
        );
        MentoringRelationshipMember mentorMembership = member(traineeRelationship, mentor, currentUser);

        when(relationshipMemberRepository.findVisibleToUser(1L))
                .thenReturn(List.of(traineeMembership, mentorMembership));
        when(employeeRepository.findDetailedByUserIdIn(any())).thenReturn(List.of());

        List<MentoringRelationshipPairDto> result = service.listMyRelationships(actor(1L, "current.user"));

        assertEquals(2, result.size());
        assertEquals(
                List.of(
                        MentoringRelationshipPairDto.ParticipantRole.MENTOR,
                        MentoringRelationshipPairDto.ParticipantRole.TRAINEE
                ),
                result.stream().map(MentoringRelationshipPairDto::currentUserRole).toList()
        );
        assertEquals("trainee", result.get(0).traineeName());
        assertEquals("mentor", result.get(1).mentorName());
    }

    @Test
    void mentorCanInviteAGroupAndEachTraineeGetsAnIndividualResponseRecordAndNotification() {
        User mentor = user(1L, "mentor");
        User traineeOne = user(2L, "trainee.one");
        User traineeTwo = user(3L, "trainee.two");
        ApidUserPrincipal actor = actor(1L, "mentor");

        when(userRepository.findByIdForUpdate(1L)).thenReturn(Optional.of(mentor));
        when(userRoleRepository.existsActiveMentorRoleByUserId(1L)).thenReturn(true);
        when(employeeRepository.existsByUserIdAndEmploymentStatus(1L, EmploymentStatus.ACTIVE)).thenReturn(true);
        when(userRepository.findAllById(any())).thenReturn(List.of(traineeOne, traineeTwo));
        when(employeeRepository.existsByUserIdAndEmploymentStatus(2L, EmploymentStatus.ACTIVE)).thenReturn(true);
        when(employeeRepository.existsByUserIdAndEmploymentStatus(3L, EmploymentStatus.ACTIVE)).thenReturn(true);
        when(relationshipRepository.countActiveTraineesByMentorUserId(1L, MentoringRelationshipStatus.ACTIVE))
                .thenReturn(0L);
        when(recipientRepository.countByMentorAndStatus(1L, MentoringRequestRecipientStatus.PENDING)).thenReturn(0L);
        when(coreConfigService.getDefaultMaxTraineesPerTrainer()).thenReturn(3);
        when(requestRepository.save(any(MentoringRequest.class))).thenAnswer(invocation -> {
            MentoringRequest request = invocation.getArgument(0);
            request.setId(50L);
            return request;
        });
        when(employeeRepository.findDetailedByUserId(1L)).thenReturn(Optional.empty());
        when(recipientRepository.findVisibleToUser(1L)).thenReturn(List.of());

        service.inviteTrainees(
                new MentorInvitationRequest(MentoringRequestType.GROUP, List.of(2L, 3L), null, "Join my class"),
                actor
        );

        ArgumentCaptor<MentoringRequest> requestCaptor = ArgumentCaptor.forClass(MentoringRequest.class);
        verify(requestRepository).save(requestCaptor.capture());
        assertEquals(MentoringRequestType.GROUP, requestCaptor.getValue().getRequestType());
        ArgumentCaptor<MentoringRequestRecipient> recipientCaptor =
                ArgumentCaptor.forClass(MentoringRequestRecipient.class);
        verify(recipientRepository, org.mockito.Mockito.times(2)).save(recipientCaptor.capture());
        assertEquals(
                Set.of(2L, 3L),
                recipientCaptor.getAllValues().stream()
                        .map(recipient -> recipient.getRecipientUser().getId())
                        .collect(java.util.stream.Collectors.toSet())
        );
        assertEquals(
                List.of(2L, 3L),
                recipientCaptor.getAllValues().stream()
                        .map(recipient -> recipient.getTraineeUser().getId())
                        .toList()
        );
        verify(notificationService, org.mockito.Mockito.times(2)).notify(
                any(Long.class),
                org.mockito.ArgumentMatchers.eq(NotificationModule.MENTORING),
                org.mockito.ArgumentMatchers.eq("MENTORING_PAIRING_REQUESTED"),
                org.mockito.ArgumentMatchers.eq("Mentoring class invitation"),
                any(String.class),
                org.mockito.ArgumentMatchers.eq("/mentoring?view=trainee")
        );
    }

    @Test
    void recipientApprovalCreatesActiveRelationshipAndNotifiesInitiatingMentor() {
        User mentor = user(1L, "mentor");
        User trainee = user(2L, "trainee");
        MentoringRequest request = request(mentor, mentor, MentoringRequestType.GROUP);
        MentoringRequestRecipient recipient = recipient(request, trainee, trainee);
        ApidUserPrincipal actor = actor(2L, "trainee");

        when(recipientRepository.findByIdForUpdate(10L)).thenReturn(Optional.of(recipient));
        when(userRepository.findByIdForUpdate(1L)).thenReturn(Optional.of(mentor));
        when(userRoleRepository.existsActiveMentorRoleByUserId(1L)).thenReturn(true);
        when(employeeRepository.existsByUserIdAndEmploymentStatus(1L, EmploymentStatus.ACTIVE)).thenReturn(true);
        when(userRepository.findById(2L)).thenReturn(Optional.of(trainee));
        when(employeeRepository.existsByUserIdAndEmploymentStatus(2L, EmploymentStatus.ACTIVE)).thenReturn(true);
        when(relationshipRepository.existsActivePair(
                1L, 2L, MentoringRelationshipStatus.ACTIVE
        )).thenReturn(false);
        when(relationshipRepository.countActiveTraineesByMentorUserId(1L, MentoringRelationshipStatus.ACTIVE))
                .thenReturn(0L);
        when(relationshipRepository.findByRequest_Id(50L)).thenReturn(Optional.empty());
        when(relationshipRepository.save(any(MentoringRelationship.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));
        when(coreConfigService.getDefaultMaxTraineesPerTrainer()).thenReturn(3);
        when(employeeRepository.findDetailedByUserId(2L)).thenReturn(Optional.empty());
        when(employeeRepository.findDetailedByUserIdIn(any())).thenReturn(List.of());

        service.respond(
                10L,
                new MentoringRequestDecision(MentoringRequestRecipientStatus.ACCEPTED),
                actor
        );

        ArgumentCaptor<MentoringRelationship> relationshipCaptor =
                ArgumentCaptor.forClass(MentoringRelationship.class);
        verify(relationshipRepository).save(relationshipCaptor.capture());
        assertEquals(MentoringRelationshipStatus.ACTIVE, relationshipCaptor.getValue().getStatus());
        assertEquals(1L, relationshipCaptor.getValue().getMentorUser().getId());
        assertEquals(50L, relationshipCaptor.getValue().getRequest().getId());
        ArgumentCaptor<MentoringRelationshipMember> memberCaptor =
                ArgumentCaptor.forClass(MentoringRelationshipMember.class);
        verify(relationshipMemberRepository).save(memberCaptor.capture());
        assertEquals(MentoringRelationshipMemberStatus.ACTIVE, memberCaptor.getValue().getStatus());
        assertEquals(2L, memberCaptor.getValue().getTraineeUser().getId());
        assertEquals(MentoringRequestRecipientStatus.ACCEPTED, recipient.getStatus());
        verify(notificationService).notify(
                org.mockito.ArgumentMatchers.eq(1L),
                org.mockito.ArgumentMatchers.eq(NotificationModule.MENTORING),
                org.mockito.ArgumentMatchers.eq("MENTORING_PAIRING_ACCEPTED"),
                any(String.class),
                any(String.class),
                org.mockito.ArgumentMatchers.eq("/mentoring?view=trainer")
        );
    }

    @Test
    void acceptedTraineesFromOneClassShareACombinedRelationship() {
        User mentor = user(1L, "mentor");
        User traineeOne = user(2L, "trainee.one");
        User traineeTwo = user(3L, "trainee.two");
        MentoringRequest request = request(mentor, mentor, MentoringRequestType.GROUP);
        MentoringRequestRecipient first = recipient(request, traineeOne, traineeOne);
        MentoringRequestRecipient second = recipient(request, traineeTwo, traineeTwo);
        MentoringRelationship sharedRelationship = new MentoringRelationship();
        sharedRelationship.setRequest(request);
        sharedRelationship.setMentorUser(mentor);

        when(recipientRepository.findByIdForUpdate(10L)).thenReturn(Optional.of(first));
        when(recipientRepository.findByIdForUpdate(11L)).thenReturn(Optional.of(second));
        when(userRepository.findByIdForUpdate(1L)).thenReturn(Optional.of(mentor));
        when(userRoleRepository.existsActiveMentorRoleByUserId(1L)).thenReturn(true);
        when(employeeRepository.existsByUserIdAndEmploymentStatus(1L, EmploymentStatus.ACTIVE)).thenReturn(true);
        when(userRepository.findById(2L)).thenReturn(Optional.of(traineeOne));
        when(userRepository.findById(3L)).thenReturn(Optional.of(traineeTwo));
        when(employeeRepository.existsByUserIdAndEmploymentStatus(2L, EmploymentStatus.ACTIVE)).thenReturn(true);
        when(employeeRepository.existsByUserIdAndEmploymentStatus(3L, EmploymentStatus.ACTIVE)).thenReturn(true);
        when(relationshipRepository.existsActivePair(1L, 2L, MentoringRelationshipStatus.ACTIVE)).thenReturn(false);
        when(relationshipRepository.existsActivePair(1L, 3L, MentoringRelationshipStatus.ACTIVE)).thenReturn(false);
        when(relationshipRepository.countActiveTraineesByMentorUserId(1L, MentoringRelationshipStatus.ACTIVE))
                .thenReturn(0L, 1L);
        when(coreConfigService.getDefaultMaxTraineesPerTrainer()).thenReturn(3);
        when(relationshipRepository.findByRequest_Id(50L))
                .thenReturn(Optional.empty(), Optional.of(sharedRelationship));
        when(relationshipRepository.save(any(MentoringRelationship.class)))
                .thenReturn(sharedRelationship);
        when(employeeRepository.findDetailedByUserId(2L)).thenReturn(Optional.empty());
        when(employeeRepository.findDetailedByUserId(3L)).thenReturn(Optional.empty());
        when(employeeRepository.findDetailedByUserIdIn(any())).thenReturn(List.of());

        service.respond(10L, new MentoringRequestDecision(MentoringRequestRecipientStatus.ACCEPTED), actor(2L, "trainee.one"));
        service.respond(11L, new MentoringRequestDecision(MentoringRequestRecipientStatus.ACCEPTED), actor(3L, "trainee.two"));

        ArgumentCaptor<MentoringRelationship> relationshipCaptor =
                ArgumentCaptor.forClass(MentoringRelationship.class);
        verify(relationshipRepository).save(relationshipCaptor.capture());
        assertEquals(50L, relationshipCaptor.getValue().getRequest().getId());
        ArgumentCaptor<MentoringRelationshipMember> memberCaptor =
                ArgumentCaptor.forClass(MentoringRelationshipMember.class);
        verify(relationshipMemberRepository, org.mockito.Mockito.times(2)).save(memberCaptor.capture());
        assertEquals(2, memberCaptor.getAllValues().size());
        assertEquals(
                List.of(2L, 3L),
                memberCaptor.getAllValues().stream()
                        .map(member -> member.getTraineeUser().getId())
                        .toList()
        );
        memberCaptor.getAllValues().forEach(member -> assertEquals(sharedRelationship, member.getRelationship()));
    }

    @Test
    void fullMentorCannotAcceptAnotherTrainee() {
        User mentor = user(1L, "mentor");
        User trainee = user(2L, "trainee");
        MentoringRequest request = request(mentor, mentor, MentoringRequestType.INDIVIDUAL);
        MentoringRequestRecipient recipient = recipient(request, trainee, trainee);

        when(recipientRepository.findByIdForUpdate(10L)).thenReturn(Optional.of(recipient));
        when(userRepository.findByIdForUpdate(1L)).thenReturn(Optional.of(mentor));
        when(userRoleRepository.existsActiveMentorRoleByUserId(1L)).thenReturn(true);
        when(employeeRepository.existsByUserIdAndEmploymentStatus(1L, EmploymentStatus.ACTIVE)).thenReturn(true);
        when(userRepository.findById(2L)).thenReturn(Optional.of(trainee));
        when(employeeRepository.existsByUserIdAndEmploymentStatus(2L, EmploymentStatus.ACTIVE)).thenReturn(true);
        when(relationshipRepository.existsActivePair(
                1L, 2L, MentoringRelationshipStatus.ACTIVE
        )).thenReturn(false);
        when(relationshipRepository.countActiveTraineesByMentorUserId(1L, MentoringRelationshipStatus.ACTIVE))
                .thenReturn(3L);
        when(coreConfigService.getDefaultMaxTraineesPerTrainer()).thenReturn(3);

        assertThrows(
                BusinessException.class,
                () -> service.respond(
                        10L,
                        new MentoringRequestDecision(MentoringRequestRecipientStatus.ACCEPTED),
                        actor(2L, "trainee")
                )
        );

        assertEquals(MentoringRequestRecipientStatus.PENDING, recipient.getStatus());
        verify(relationshipRepository, never()).save(any(MentoringRelationship.class));
        verify(relationshipMemberRepository, never()).save(any(MentoringRelationshipMember.class));
        verify(notificationService, never()).notify(
                any(Long.class), any(), any(String.class), any(String.class), any(String.class), any(String.class)
        );
    }

    @Test
    void onlyTheIntendedRecipientCanAnswerARequest() {
        User mentor = user(1L, "mentor");
        User trainee = user(2L, "trainee");
        MentoringRequest request = request(mentor, mentor, MentoringRequestType.INDIVIDUAL);
        MentoringRequestRecipient recipient = recipient(request, trainee, trainee);
        when(recipientRepository.findByIdForUpdate(10L)).thenReturn(Optional.of(recipient));

        assertThrows(
                AccessDeniedException.class,
                () -> service.respond(
                        10L,
                        new MentoringRequestDecision(MentoringRequestRecipientStatus.DECLINED),
                        actor(3L, "other")
                )
        );
    }

    private static MentoringRequest request(User mentor, User initiator, MentoringRequestType type) {
        MentoringRequest request = new MentoringRequest();
        request.setId(50L);
        request.setMentorUser(mentor);
        request.setInitiatedByUser(initiator);
        request.setRequestType(type);
        return request;
    }

    private static MentoringRequestRecipient recipient(MentoringRequest request, User recipientUser, User trainee) {
        MentoringRequestRecipient recipient = new MentoringRequestRecipient();
        recipient.setRequest(request);
        recipient.setRecipientUser(recipientUser);
        recipient.setTraineeUser(trainee);
        return recipient;
    }

    private static MentoringRelationship relationship(
            MentoringRequest request,
            User mentor,
            MentoringRelationshipStatus status
    ) {
        MentoringRelationship relationship = new MentoringRelationship();
        relationship.setRequest(request);
        relationship.setMentorUser(mentor);
        relationship.setStatus(status);
        return relationship;
    }

    private static MentoringRelationshipMember member(
            MentoringRelationship relationship,
            User mentor,
            User trainee
    ) {
        MentoringRelationshipMember member = new MentoringRelationshipMember();
        member.setRelationship(relationship);
        member.setMentorUser(mentor);
        member.setTraineeUser(trainee);
        return member;
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
