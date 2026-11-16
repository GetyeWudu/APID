package com.boa.apid.mentoring.matching.service;

import com.boa.apid.common.exception.BusinessException;
import com.boa.apid.core.audit.service.AuditService;
import com.boa.apid.core.auth.security.ApidUserPrincipal;
import com.boa.apid.core.authorization.entity.User;
import com.boa.apid.core.authorization.repository.UserRepository;
import com.boa.apid.core.notifications.service.NotificationService;
import com.boa.apid.core.organization.entity.Employee;
import com.boa.apid.core.organization.repository.EmployeeRepository;
import com.boa.apid.core.skills.entity.Skill;
import com.boa.apid.core.skills.repository.SkillRepository;
import com.boa.apid.mentoring.matching.dto.MentoringReassignmentInput;
import com.boa.apid.mentoring.matching.repository.MentoringMatchRequestRepository;
import com.boa.apid.mentoring.pairing.entity.MentoringRelationship;
import com.boa.apid.mentoring.pairing.entity.MentoringRelationshipMember;
import com.boa.apid.mentoring.pairing.entity.MentoringRelationshipMemberStatus;
import com.boa.apid.mentoring.pairing.entity.MentoringRequest;
import com.boa.apid.mentoring.pairing.entity.MentoringRelationshipStatus;
import com.boa.apid.mentoring.pairing.entity.MentoringRequestType;
import com.boa.apid.mentoring.pairing.repository.MentoringRelationshipMemberRepository;
import com.boa.apid.mentoring.pairing.repository.MentoringRelationshipRepository;
import com.boa.apid.mentoring.pairing.repository.MentoringRequestRecipientRepository;
import com.boa.apid.mentoring.pairing.repository.MentoringRequestRepository;
import com.boa.apid.mentoring.trainer.entity.TrainerAuthorization;
import com.boa.apid.mentoring.trainer.repository.TrainerAuthorizationRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class MentoringMatchServiceReassignmentTest {

    @Mock private MentoringMatchRequestRepository matchRequestRepository;
    @Mock private EmployeeRepository employeeRepository;
    @Mock private UserRepository userRepository;
    @Mock private SkillRepository skillRepository;
    @Mock private TrainerAuthorizationRepository trainerAuthorizationRepository;
    @Mock private MentoringRequestRepository mentoringRequestRepository;
    @Mock private MentoringRequestRecipientRepository recipientRepository;
    @Mock private MentoringRelationshipRepository relationshipRepository;
    @Mock private MentoringRelationshipMemberRepository memberRepository;
    @Mock private NotificationService notificationService;
    @Mock private AuditService auditService;

    @InjectMocks
    private MentoringMatchService service;

    @Test
    void refusesToReassignRelationshipThatIsNotPaused() {
        MentoringRelationship relationship = new MentoringRelationship();
        relationship.setStatus(MentoringRelationshipStatus.ACTIVE);
        when(relationshipRepository.findByIdForUpdate(12L)).thenReturn(Optional.of(relationship));

        assertThrows(BusinessException.class, () -> service.reassign(
                12L,
                new MentoringReassignmentInput(30L, "Trainer unavailable", false, null, null),
                hrPrincipal()
        ));

        verify(memberRepository, never()).findByRelationship_IdOrderByJoinedAtAsc(12L);
    }

    @Test
    void refusesToReassignPausedRelationshipWithoutActiveTrainees() {
        MentoringRelationship relationship = new MentoringRelationship();
        relationship.setStatus(MentoringRelationshipStatus.PAUSED);
        when(relationshipRepository.findByIdForUpdate(12L)).thenReturn(Optional.of(relationship));
        when(memberRepository.findByRelationship_IdOrderByJoinedAtAsc(12L)).thenReturn(List.of());

        assertThrows(BusinessException.class, () -> service.reassign(
                12L,
                new MentoringReassignmentInput(30L, "Trainer unavailable", false, null, null),
                hrPrincipal()
        ));

        verify(userRepository, never()).findByIdForUpdate(30L);
    }

    @Test
    void requiresReasonWhenHrOverridesTrainerSkillMismatch() {
        User formerTrainer = new User();
        formerTrainer.setId(20L);
        User trainee = new User();
        trainee.setId(40L);
        User replacementTrainer = new User();
        replacementTrainer.setId(30L);

        Skill requestedSkill = new Skill();
        requestedSkill.setId(9L);
        MentoringRequest request = new MentoringRequest();
        request.setSkill(requestedSkill);

        MentoringRelationship relationship = new MentoringRelationship();
        relationship.setStatus(MentoringRelationshipStatus.PAUSED);
        relationship.setRequest(request);
        relationship.setMentorUser(formerTrainer);
        when(relationshipRepository.findByIdForUpdate(12L)).thenReturn(Optional.of(relationship));

        MentoringRelationshipMember activeMember = new MentoringRelationshipMember();
        activeMember.setStatus(MentoringRelationshipMemberStatus.ACTIVE);
        activeMember.setTraineeUser(trainee);
        when(memberRepository.findByRelationship_IdOrderByJoinedAtAsc(12L)).thenReturn(List.of(activeMember));
        when(userRepository.findByIdForUpdate(30L)).thenReturn(Optional.of(replacementTrainer));

        TrainerAuthorization authorization = new TrainerAuthorization();
        authorization.setMaxConcurrentTrainees(3);
        authorization.setSkills(Set.of());
        when(trainerAuthorizationRepository.findActiveByUserId(30L)).thenReturn(List.of(authorization));
        when(employeeRepository.existsByUserIdAndEmploymentStatus(anyLong(), any())).thenReturn(true);

        BusinessException exception = assertThrows(BusinessException.class, () -> service.reassign(
                12L,
                new MentoringReassignmentInput(30L, "Trainer unavailable", false, null, "  "),
                hrPrincipal()
        ));

        assertEquals("SKILL_OVERRIDE_REASON_REQUIRED", exception.getErrorCode());
        verify(mentoringRequestRepository, never()).save(any());
    }

    @Test
    void allowsAndAuditsSkillMismatchOverrideWithReason() {
        User formerTrainer = new User();
        formerTrainer.setId(20L);
        User trainee = new User();
        trainee.setId(40L);
        User replacementTrainer = new User();
        replacementTrainer.setId(30L);
        User hrUser = new User();
        hrUser.setId(5L);

        Skill requestedSkill = new Skill();
        requestedSkill.setId(9L);
        MentoringRequest request = new MentoringRequest();
        request.setRequestType(MentoringRequestType.INDIVIDUAL);
        request.setSkill(requestedSkill);

        MentoringRelationship relationship = new MentoringRelationship();
        relationship.setStatus(MentoringRelationshipStatus.PAUSED);
        relationship.setRequest(request);
        relationship.setMentorUser(formerTrainer);
        when(relationshipRepository.findByIdForUpdate(12L)).thenReturn(Optional.of(relationship));

        MentoringRelationshipMember activeMember = new MentoringRelationshipMember();
        activeMember.setStatus(MentoringRelationshipMemberStatus.ACTIVE);
        activeMember.setTraineeUser(trainee);
        when(memberRepository.findByRelationship_IdOrderByJoinedAtAsc(12L)).thenReturn(List.of(activeMember));
        when(userRepository.findByIdForUpdate(30L)).thenReturn(Optional.of(replacementTrainer));

        Employee employee = new Employee();
        employee.setFullName("Replacement Trainer");
        TrainerAuthorization authorization = new TrainerAuthorization();
        authorization.setEmployee(employee);
        authorization.setMaxConcurrentTrainees(3);
        authorization.setSkills(Set.of());
        when(trainerAuthorizationRepository.findActiveByUserId(30L)).thenReturn(List.of(authorization));
        when(employeeRepository.existsByUserIdAndEmploymentStatus(anyLong(), any())).thenReturn(true);
        when(userRepository.findById(5L)).thenReturn(Optional.of(hrUser));
        when(recipientRepository.saveAll(anyList())).thenAnswer(invocation -> invocation.getArgument(0));
        when(mentoringRequestRepository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));
        when(relationshipRepository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));

        service.reassign(
                12L,
                new MentoringReassignmentInput(
                        30L, "Trainer unavailable", false, null, "Temporary coverage approved by HR"),
                hrPrincipal()
        );

        org.mockito.ArgumentCaptor<AuditService.AuditCommand> auditCommand =
                org.mockito.ArgumentCaptor.forClass(AuditService.AuditCommand.class);
        verify(auditService).record(auditCommand.capture());
        assertEquals(Boolean.TRUE, auditCommand.getValue().details().get("skillMismatchOverride"));
        assertEquals(
                "Temporary coverage approved by HR",
                auditCommand.getValue().details().get("skillOverrideReason")
        );
        assertFalse(auditCommand.getValue().details().containsKey("overrideReason"));
    }

    private ApidUserPrincipal hrPrincipal() {
        return new ApidUserPrincipal(5L, "hr.user", true, false, 1, Set.of(),
                Set.of("MENTORING_MATCH_MANAGE"));
    }
}
