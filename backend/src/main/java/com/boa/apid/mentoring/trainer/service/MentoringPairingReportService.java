package com.boa.apid.mentoring.trainer.service;

import com.boa.apid.core.audit.entity.AuditLog;
import com.boa.apid.core.audit.repository.AuditLogRepository;
import com.boa.apid.core.authorization.entity.User;
import com.boa.apid.core.organization.entity.Employee;
import com.boa.apid.core.organization.repository.EmployeeRepository;
import com.boa.apid.mentoring.pairing.entity.MentoringRelationship;
import com.boa.apid.mentoring.pairing.entity.MentoringRelationshipMember;
import com.boa.apid.mentoring.pairing.entity.MentoringRelationshipStatus;
import com.boa.apid.mentoring.pairing.entity.MentoringSession;
import com.boa.apid.mentoring.pairing.entity.MentoringSessionStatus;
import com.boa.apid.mentoring.pairing.repository.MentoringRelationshipMemberRepository;
import com.boa.apid.mentoring.pairing.repository.MentoringRelationshipRepository;
import com.boa.apid.mentoring.pairing.repository.MentoringSessionRepository;
import com.boa.apid.mentoring.trainer.dto.MentoringPairingReportDetailDto;
import com.boa.apid.mentoring.trainer.dto.MentoringPairingReportOverviewDto;
import com.boa.apid.mentoring.trainer.dto.MentoringPairingReportSummaryDto;
import com.boa.apid.common.exception.ResourceNotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
public class MentoringPairingReportService {

    private static final String RELATIONSHIP_ENTITY_TYPE = "MENTORING_RELATIONSHIP";
    private static final String COMPLETED_ACTION = "MENTORING_RELATIONSHIP_COMPLETED";

    private final MentoringRelationshipRepository relationshipRepository;
    private final MentoringRelationshipMemberRepository memberRepository;
    private final MentoringSessionRepository sessionRepository;
    private final EmployeeRepository employeeRepository;
    private final AuditLogRepository auditLogRepository;

    public MentoringPairingReportService(
            MentoringRelationshipRepository relationshipRepository,
            MentoringRelationshipMemberRepository memberRepository,
            MentoringSessionRepository sessionRepository,
            EmployeeRepository employeeRepository,
            AuditLogRepository auditLogRepository
    ) {
        this.relationshipRepository = relationshipRepository;
        this.memberRepository = memberRepository;
        this.sessionRepository = sessionRepository;
        this.employeeRepository = employeeRepository;
        this.auditLogRepository = auditLogRepository;
    }

    @Transactional(readOnly = true)
    public MentoringPairingReportOverviewDto getOverview() {
        List<MentoringRelationship> relationships =
                relationshipRepository.findAllByOrderByStartedAtDescIdDesc();
        List<Long> relationshipIds = relationships.stream().map(MentoringRelationship::getId).toList();
        List<MentoringRelationshipMember> members = relationshipIds.isEmpty()
                ? List.of()
                : memberRepository.findByRelationship_IdInOrderByJoinedAtAsc(relationshipIds);
        List<MentoringSession> sessions = relationshipIds.isEmpty()
                ? List.of()
                : sessionRepository.findByRelationship_IdInOrderByScheduledStartDesc(relationshipIds);

        Map<Long, List<MentoringRelationshipMember>> membersByRelationship = members.stream()
                .collect(Collectors.groupingBy(
                        member -> member.getRelationship().getId(),
                        LinkedHashMap::new,
                        Collectors.toList()
                ));
        Map<Long, List<MentoringSession>> sessionsByRelationship = sessions.stream()
                .collect(Collectors.groupingBy(
                        session -> session.getRelationship().getId(),
                        LinkedHashMap::new,
                        Collectors.toList()
                ));
        Map<Long, Employee> employeesByUserId = loadEmployees(relationships, members);

        List<MentoringPairingReportSummaryDto> pairings = relationships.stream()
                .map(relationship -> toSummary(
                        relationship,
                        membersByRelationship.getOrDefault(relationship.getId(), List.of()),
                        sessionsByRelationship.getOrDefault(relationship.getId(), List.of()),
                        employeesByUserId
                ))
                .toList();
        long completedPairings = relationships.stream()
                .filter(relationship -> relationship.getStatus() == MentoringRelationshipStatus.COMPLETED)
                .count();
        long completedSessions = sessions.stream()
                .filter(session -> session.getStatus() == MentoringSessionStatus.COMPLETED)
                .count();

        return new MentoringPairingReportOverviewDto(
                relationships.size(),
                completedPairings,
                percentage(completedPairings, relationships.size()),
                sessions.size(),
                completedSessions,
                percentage(completedSessions, sessions.size()),
                pairings
        );
    }

    @Transactional(readOnly = true)
    public MentoringPairingReportDetailDto getDetail(Long relationshipId) {
        MentoringRelationship relationship = relationshipRepository.findDetailedById(relationshipId)
                .orElseThrow(() -> new ResourceNotFoundException("Mentoring pairing report not found"));
        List<MentoringRelationshipMember> members =
                memberRepository.findByRelationship_IdOrderByJoinedAtAsc(relationshipId);
        List<MentoringSession> sessions =
                sessionRepository.findByRelationship_IdOrderByScheduledStartDesc(relationshipId);
        Map<Long, Employee> employeesByUserId = loadEmployees(List.of(relationship), members);
        MentoringPairingReportSummaryDto pairing =
                toSummary(relationship, members, sessions, employeesByUserId);
        String completionNote = relationship.getStatus() == MentoringRelationshipStatus.COMPLETED
                ? getCompletionNote(relationshipId)
                : null;

        return new MentoringPairingReportDetailDto(
                pairing,
                completionNote,
                sessions.stream()
                        .map(session -> new MentoringPairingReportDetailDto.SessionReport(
                                session.getId(),
                                session.getTitle(),
                                session.getAgenda(),
                                session.getScheduledStart(),
                                session.getScheduledEnd(),
                                session.getStatus(),
                                session.getNotes()
                        ))
                        .toList()
        );
    }

    private MentoringPairingReportSummaryDto toSummary(
            MentoringRelationship relationship,
            List<MentoringRelationshipMember> members,
            List<MentoringSession> sessions,
            Map<Long, Employee> employeesByUserId
    ) {
        long completedSessions = sessions.stream()
                .filter(session -> session.getStatus() == MentoringSessionStatus.COMPLETED)
                .count();
        User mentor = relationship.getMentorUser();
        return new MentoringPairingReportSummaryDto(
                relationship.getId(),
                relationship.getRequest().getId(),
                relationship.getRequest().getRequestType(),
                relationship.getStatus(),
                displayName(mentor, employeesByUserId),
                members.stream()
                        .map(member -> displayName(member.getTraineeUser(), employeesByUserId))
                        .toList(),
                relationship.getRequest().getSkill() == null
                        ? null
                        : relationship.getRequest().getSkill().getName(),
                relationship.getStartedAt(),
                relationship.getEndedAt(),
                sessions.size(),
                completedSessions,
                percentage(completedSessions, sessions.size())
        );
    }

    private Map<Long, Employee> loadEmployees(
            Collection<MentoringRelationship> relationships,
            Collection<MentoringRelationshipMember> members
    ) {
        Set<Long> userIds = new LinkedHashSet<>();
        relationships.forEach(relationship -> userIds.add(relationship.getMentorUser().getId()));
        members.forEach(member -> userIds.add(member.getTraineeUser().getId()));
        if (userIds.isEmpty()) {
            return Map.of();
        }
        return employeeRepository.findDetailedByUserIdIn(userIds).stream()
                .filter(employee -> employee.getUserId() != null)
                .collect(Collectors.toMap(
                        Employee::getUserId,
                        Function.identity(),
                        (first, ignored) -> first,
                        LinkedHashMap::new
                ));
    }

    private String displayName(User user, Map<Long, Employee> employeesByUserId) {
        Employee employee = employeesByUserId.get(user.getId());
        return employee == null ? user.getUsername() : employee.getFullName();
    }

    private String getCompletionNote(Long relationshipId) {
        List<AuditLog> events = auditLogRepository
                .findByEntityTypeAndEntityIdAndResultAndActionInOrderByCreatedAtDescIdDesc(
                        RELATIONSHIP_ENTITY_TYPE,
                        relationshipId.toString(),
                        "SUCCESS",
                        List.of(COMPLETED_ACTION)
                );
        if (events.isEmpty() || events.get(0).getDetailsJson() == null) {
            return null;
        }
        Object reason = events.get(0).getDetailsJson().get("reason");
        return reason == null ? null : reason.toString();
    }

    private double percentage(long completed, long total) {
        return total == 0 ? 0 : Math.round(completed * 1000.0 / total) / 10.0;
    }
}
