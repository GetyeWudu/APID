package com.boa.apid.mentoring.trainer.service;

import com.boa.apid.core.audit.service.AuditService;
import com.boa.apid.core.auth.security.ApidUserPrincipal;
import com.boa.apid.core.authorization.entity.User;
import com.boa.apid.core.authorization.repository.RoleRepository;
import com.boa.apid.core.authorization.repository.UserRepository;
import com.boa.apid.core.authorization.repository.UserRoleRepository;
import com.boa.apid.core.config.service.CoreConfigService;
import com.boa.apid.core.notifications.service.NotificationService;
import com.boa.apid.core.organization.entity.Employee;
import com.boa.apid.core.organization.entity.EmploymentStatus;
import com.boa.apid.core.organization.repository.EmployeeRepository;
import com.boa.apid.core.skills.entity.Skill;
import com.boa.apid.core.skills.repository.SkillRepository;
import com.boa.apid.mentoring.application.entity.MentorApplication;
import com.boa.apid.mentoring.application.repository.MentorApplicationRepository;
import com.boa.apid.mentoring.collaboration.repository.MentoringRelationshipFeedbackRepository;
import com.boa.apid.mentoring.matching.repository.MentoringMatchRequestRepository;
import com.boa.apid.mentoring.pairing.repository.MentoringRelationshipMemberRepository;
import com.boa.apid.mentoring.pairing.repository.MentoringRelationshipRepository;
import com.boa.apid.mentoring.pairing.repository.MentoringRequestRecipientRepository;
import com.boa.apid.mentoring.pairing.repository.MentoringSessionRepository;
import com.boa.apid.mentoring.trainer.entity.TrainerAuthorization;
import com.boa.apid.mentoring.trainer.entity.TrainerAuthorizationSkillStatus;
import com.boa.apid.mentoring.trainer.entity.TrainerAuthorizationStatus;
import com.boa.apid.mentoring.trainer.repository.TrainerAuthorizationRepository;
import com.boa.apid.mentoring.trainer.repository.TrainerAuthorizationSkillStatusRepository;
import com.boa.apid.mentoring.trainer.repository.TrainerStatusHistoryRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.context.ApplicationEventPublisher;

import java.util.LinkedHashSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotSame;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class TrainerAuthorizationServiceApplicationTest {

    @Mock private TrainerAuthorizationRepository authorizationRepository;
    @Mock private TrainerAuthorizationSkillStatusRepository skillStatusRepository;
    @Mock private TrainerStatusHistoryRepository historyRepository;
    @Mock private MentorApplicationRepository applicationRepository;
    @Mock private EmployeeRepository employeeRepository;
    @Mock private UserRepository userRepository;
    @Mock private RoleRepository roleRepository;
    @Mock private UserRoleRepository userRoleRepository;
    @Mock private SkillRepository skillRepository;
    @Mock private MentoringRelationshipRepository relationshipRepository;
    @Mock private MentoringRelationshipMemberRepository memberRepository;
    @Mock private MentoringRequestRecipientRepository recipientRepository;
    @Mock private MentoringSessionRepository sessionRepository;
    @Mock private MentoringRelationshipFeedbackRepository feedbackRepository;
    @Mock private MentoringMatchRequestRepository matchRequestRepository;
    @Mock private CoreConfigService configService;
    @Mock private NotificationService notificationService;
    @Mock private AuditService auditService;
    @Mock private ApplicationEventPublisher eventPublisher;

    @InjectMocks
    private TrainerAuthorizationService service;

    @Test
    void copiesApplicationSkillCollectionBeforePersistingAuthorization() {
        User applicant = new User();
        applicant.setId(8L);
        Employee employee = new Employee();
        employee.setUserId(8L);
        employee.setEmploymentStatus(EmploymentStatus.ACTIVE);

        Skill firstSkill = new Skill();
        firstSkill.setId(1L);
        Skill secondSkill = new Skill();
        secondSkill.setId(2L);
        Set<Skill> applicationSkills = new LinkedHashSet<>(List.of(firstSkill, secondSkill));

        MentorApplication application = new MentorApplication();
        application.setApplicant(applicant);
        application.setCatalogSkill(firstSkill);
        application.setCatalogSkills(applicationSkills);
        application.setMaxConcurrentTrainees(3);

        when(employeeRepository.findDetailedByUserId(8L)).thenReturn(Optional.of(employee));
        when(authorizationRepository.save(any(TrainerAuthorization.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        service.authorizeApplication(application, new User());

        ArgumentCaptor<TrainerAuthorization> authorizationCaptor =
                ArgumentCaptor.forClass(TrainerAuthorization.class);
        verify(authorizationRepository).save(authorizationCaptor.capture());
        assertEquals(applicationSkills, authorizationCaptor.getValue().getSkills());
        assertNotSame(application.getCatalogSkills(), authorizationCaptor.getValue().getSkills());
    }

    @Test
    void addsApprovedApplicationSkillsToExistingAuthorizationInsteadOfCreatingAnother() {
        User applicant = new User();
        applicant.setId(8L);
        Employee employee = new Employee();
        employee.setId(6L);
        employee.setUserId(8L);
        employee.setEmploymentStatus(EmploymentStatus.ACTIVE);

        Skill existingSkill = new Skill();
        existingSkill.setId(1L);
        Skill additionalSkill = new Skill();
        additionalSkill.setId(2L);
        TrainerAuthorization existingAuthorization = new TrainerAuthorization();
        existingAuthorization.setEmployee(employee);
        existingAuthorization.setSkills(new LinkedHashSet<>(List.of(existingSkill)));
        org.springframework.test.util.ReflectionTestUtils.setField(existingAuthorization, "id", 66L);
        TrainerAuthorizationSkillStatus existingSkillStatus = new TrainerAuthorizationSkillStatus();
        existingSkillStatus.setSkill(existingSkill);
        existingSkillStatus.setStatus(TrainerAuthorizationStatus.ACTIVE);
        User reviewer = new User();
        reviewer.setId(9L);

        MentorApplication application = new MentorApplication();
        org.springframework.test.util.ReflectionTestUtils.setField(application, "id", 4L);
        application.setApplicant(applicant);
        application.setCatalogSkill(existingSkill);
        application.setCatalogSkills(new LinkedHashSet<>(List.of(existingSkill, additionalSkill)));

        when(employeeRepository.findDetailedByUserId(8L)).thenReturn(Optional.of(employee));
        when(authorizationRepository.findByEmployeeAndStatuses(
                6L, List.of(TrainerAuthorizationStatus.ACTIVE, TrainerAuthorizationStatus.SUSPENDED)
        )).thenReturn(List.of(existingAuthorization));
        when(authorizationRepository.save(any(TrainerAuthorization.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));
        when(skillStatusRepository.findByAuthorization_IdOrderBySkill_NameAsc(66L))
                .thenReturn(List.of(existingSkillStatus));

        TrainerAuthorization saved = service.authorizeApplication(application, reviewer);

        assertEquals(existingAuthorization, saved);
        assertEquals(Set.of(existingSkill, additionalSkill), saved.getSkills());
        verify(authorizationRepository, org.mockito.Mockito.times(2)).save(existingAuthorization);
        verify(skillStatusRepository).saveAll(any());
        verify(historyRepository).saveAll(any());
    }

    @Test
    void mentorWorkspaceAccessIsAvailableForActiveAuthorization() {
        when(authorizationRepository.findByUserIdAndStatus(8L, TrainerAuthorizationStatus.ACTIVE))
                .thenReturn(List.of(new TrainerAuthorization()));

        assertTrue(service.hasMentorWorkspaceAccess(mentorActor(8L)));
    }

    @Test
    void mentorWorkspaceAccessRemainsWhileSuspendedButNotAfterRevocation() {
        when(authorizationRepository.findByUserIdAndStatus(8L, TrainerAuthorizationStatus.ACTIVE))
                .thenReturn(List.of());
        when(authorizationRepository.findByUserIdAndStatus(8L, TrainerAuthorizationStatus.SUSPENDED))
                .thenReturn(List.of(new TrainerAuthorization()), List.of());

        assertTrue(service.hasMentorWorkspaceAccess(mentorActor(8L)));
        assertFalse(service.hasMentorWorkspaceAccess(mentorActor(8L)));
    }

    private ApidUserPrincipal mentorActor(Long userId) {
        return new ApidUserPrincipal(userId, "mentor", true, false, 0, Set.of("Mentor"), Set.of());
    }
}
