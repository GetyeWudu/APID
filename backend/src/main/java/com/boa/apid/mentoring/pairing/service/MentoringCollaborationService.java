package com.boa.apid.mentoring.pairing.service;

import com.boa.apid.common.exception.BusinessException;
import com.boa.apid.common.exception.ResourceNotFoundException;
import com.boa.apid.core.auth.security.ApidUserPrincipal;
import com.boa.apid.core.authorization.entity.User;
import com.boa.apid.core.authorization.repository.UserRepository;
import com.boa.apid.core.organization.entity.Employee;
import com.boa.apid.core.organization.repository.EmployeeRepository;
import com.boa.apid.mentoring.pairing.dto.MentoringChatHistoryDto;
import com.boa.apid.mentoring.pairing.dto.MentoringChatMessageDto;
import com.boa.apid.mentoring.pairing.dto.MentoringChatMessageRequest;
import com.boa.apid.mentoring.pairing.dto.MentoringPairingDetailDto;
import com.boa.apid.mentoring.pairing.dto.MentoringRelationshipPairDto;
import com.boa.apid.mentoring.pairing.dto.MentoringSessionDto;
import com.boa.apid.mentoring.pairing.dto.MentoringSessionRequest;
import com.boa.apid.mentoring.pairing.entity.MentoringDeliveryMode;
import com.boa.apid.mentoring.pairing.entity.MentoringMessage;
import com.boa.apid.mentoring.pairing.entity.MentoringRelationship;
import com.boa.apid.mentoring.pairing.entity.MentoringRelationshipMember;
import com.boa.apid.mentoring.pairing.entity.MentoringRelationshipMemberStatus;
import com.boa.apid.mentoring.pairing.entity.MentoringRelationshipStatus;
import com.boa.apid.mentoring.pairing.entity.MentoringSession;
import com.boa.apid.mentoring.pairing.entity.MentoringSessionStatus;
import com.boa.apid.mentoring.pairing.repository.MentoringMessageRepository;
import com.boa.apid.mentoring.pairing.repository.MentoringRelationshipMemberRepository;
import com.boa.apid.mentoring.pairing.repository.MentoringRelationshipRepository;
import com.boa.apid.mentoring.pairing.repository.MentoringSessionRepository;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.net.URI;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

@Service
public class MentoringCollaborationService {

    private static final int MAX_MESSAGE_LENGTH = 4000;
    private static final int MAX_CHAT_PAGE_SIZE = 100;
    private static final int MAX_CHAT_PAGE_INDEX = 10000;

    private final MentoringRelationshipRepository relationshipRepository;
    private final MentoringRelationshipMemberRepository memberRepository;
    private final MentoringSessionRepository sessionRepository;
    private final MentoringMessageRepository messageRepository;
    private final EmployeeRepository employeeRepository;
    private final UserRepository userRepository;

    public MentoringCollaborationService(
            MentoringRelationshipRepository relationshipRepository,
            MentoringRelationshipMemberRepository memberRepository,
            MentoringSessionRepository sessionRepository,
            MentoringMessageRepository messageRepository,
            EmployeeRepository employeeRepository,
            UserRepository userRepository
    ) {
        this.relationshipRepository = relationshipRepository;
        this.memberRepository = memberRepository;
        this.sessionRepository = sessionRepository;
        this.messageRepository = messageRepository;
        this.employeeRepository = employeeRepository;
        this.userRepository = userRepository;
    }

    @Transactional(readOnly = true)
    public MentoringPairingDetailDto getPairingDetail(Long relationshipId, ApidUserPrincipal actor) {
        MentoringRelationship relationship = requireRelationshipAccess(relationshipId, actor.getUserId());
        List<MentoringRelationshipMember> members =
                memberRepository.findByRelationship_IdOrderByJoinedAtAsc(relationshipId);

        Set<Long> userIds = new LinkedHashSet<>();
        userIds.add(relationship.getMentorUser().getId());
        members.forEach(member -> userIds.add(member.getTraineeUser().getId()));
        Map<Long, Employee> employeesByUserId = loadEmployees(userIds);

        return new MentoringPairingDetailDto(
                relationship.getId(),
                relationship.getRequest().getId(),
                relationship.getRequest().getRequestType(),
                relationship.getStatus(),
                relationship.getMentorUser().getId(),
                employeeName(relationship.getMentorUser().getId(), relationship.getMentorUser().getUsername(), employeesByUserId),
                relationship.getRequest().getSkill() == null
                        ? null
                        : relationship.getRequest().getSkill().getName(),
                relationship.getRequest().getMessage(),
                relationship.getStartedAt(),
                relationship.getEndedAt(),
                relationship.getMentorUser().getId().equals(actor.getUserId())
                        ? MentoringRelationshipPairDto.ParticipantRole.MENTOR
                        : MentoringRelationshipPairDto.ParticipantRole.TRAINEE,
                members.stream()
                        .map(member -> new MentoringPairingDetailDto.Trainee(
                                member.getTraineeUser().getId(),
                                employeeName(
                                        member.getTraineeUser().getId(),
                                        member.getTraineeUser().getUsername(),
                                        employeesByUserId
                                ),
                                member.getStatus(),
                                member.getJoinedAt(),
                                member.getEndedAt()
                        ))
                        .toList()
        );
    }

    @Transactional(readOnly = true)
    public List<MentoringSessionDto> listSessions(Long relationshipId, ApidUserPrincipal actor) {
        requireRelationshipAccess(relationshipId, actor.getUserId());
        List<MentoringSession> sessions =
                sessionRepository.findByRelationship_IdOrderByScheduledStartDesc(relationshipId);
        Map<Long, Employee> employeesByUserId = loadEmployees(
                sessions.stream().map(session -> session.getCreatedByUser().getId()).toList()
        );
        return sessions.stream()
                .map(session -> toSessionDto(session, employeesByUserId))
                .toList();
    }

    @Transactional
    public MentoringSessionDto createSession(
            Long relationshipId,
            MentoringSessionRequest body,
            ApidUserPrincipal actor
    ) {
        MentoringRelationship relationship = requireRelationshipAccess(relationshipId, actor.getUserId());
        if (!relationship.getMentorUser().getId().equals(actor.getUserId())) {
            throw new AccessDeniedException("Only the mentor can schedule a session.");
        }
        if (relationship.getStatus() != MentoringRelationshipStatus.ACTIVE) {
            throw new BusinessException(
                    "MENTORING_RELATIONSHIP_NOT_ACTIVE",
                    "Sessions can only be scheduled for an active mentoring relationship.",
                    HttpStatus.CONFLICT
            );
        }
        validateSession(body);

        MentoringSession session = new MentoringSession();
        session.setRelationship(relationship);
        session.setTitle(body.title().trim());
        session.setAgenda(normalizeOptionalText(body.agenda()));
        session.setScheduledStart(body.scheduledStart());
        session.setScheduledEnd(body.scheduledEnd());
        session.setDeliveryMode(body.deliveryMode());
        session.setMeetingUrl(normalizeMeetingUrl(body.meetingUrl()));
        session.setCreatedByUser(relationship.getMentorUser());

        MentoringSession saved = sessionRepository.save(session);
        Map<Long, Employee> employeesByUserId = loadEmployees(List.of(actor.getUserId()));
        return toSessionDto(saved, employeesByUserId);
    }

    @Transactional(readOnly = true)
    public MentoringChatHistoryDto listMessages(
            Long relationshipId,
            int requestedPage,
            int requestedPageSize,
            ApidUserPrincipal actor
    ) {
        requireRelationshipAccess(relationshipId, actor.getUserId());
        if (requestedPage < 0 || requestedPage > MAX_CHAT_PAGE_INDEX) {
            throw new BusinessException("INVALID_CHAT_PAGE", "Choose a valid chat history page.");
        }
        if (requestedPageSize < 1 || requestedPageSize > MAX_CHAT_PAGE_SIZE) {
            throw new BusinessException(
                    "INVALID_CHAT_PAGE_SIZE",
                    "Chat history page size must be between 1 and " + MAX_CHAT_PAGE_SIZE + "."
            );
        }

        List<MentoringMessage> newestFirst = messageRepository.findByRelationship_IdOrderByCreatedAtDesc(
                relationshipId,
                PageRequest.of(requestedPage, requestedPageSize + 1)
        );
        boolean hasMore = newestFirst.size() > requestedPageSize;
        List<MentoringMessage> page = new ArrayList<>(
                newestFirst.subList(0, Math.min(newestFirst.size(), requestedPageSize))
        );
        Collections.reverse(page);

        Map<Long, Employee> employeesByUserId = loadEmployees(page.stream()
                .map(message -> message.getSenderUser().getId())
                .toList());
        List<MentoringChatMessageDto> messages = page.stream()
                .map(message -> toMessageDto(message, actor.getUserId(), employeesByUserId))
                .toList();
        return new MentoringChatHistoryDto(messages, requestedPage, requestedPageSize, hasMore);
    }

    @Transactional
    public MentoringChatMessageDto sendMessage(
            Long relationshipId,
            MentoringChatMessageRequest body,
            ApidUserPrincipal actor
    ) {
        MentoringRelationship relationship = requireRelationshipAccess(relationshipId, actor.getUserId());
        ensureWritableParticipant(relationship, actor.getUserId());
        if (body == null || body.body() == null || body.body().isBlank()) {
            throw new BusinessException("MENTORING_MESSAGE_REQUIRED", "Enter a message before sending.");
        }
        String messageBody = body.body().trim();
        if (messageBody.length() > MAX_MESSAGE_LENGTH) {
            throw new BusinessException(
                    "MENTORING_MESSAGE_TOO_LONG",
                    "Messages cannot exceed " + MAX_MESSAGE_LENGTH + " characters."
            );
        }

        User sender = userRepository.findById(actor.getUserId())
                .orElseThrow(() -> new ResourceNotFoundException("User account not found"));
        MentoringMessage message = new MentoringMessage();
        message.setRelationship(relationship);
        message.setSenderUser(sender);
        message.setBody(messageBody);
        MentoringMessage saved = messageRepository.save(message);
        return toMessageDto(saved, actor.getUserId(), loadEmployees(List.of(actor.getUserId())));
    }

    private MentoringRelationship requireRelationshipAccess(Long relationshipId, Long userId) {
        MentoringRelationship relationship = relationshipRepository.findDetailedById(relationshipId)
                .orElseThrow(() -> new ResourceNotFoundException("Mentoring relationship not found"));
        boolean isMentor = relationship.getMentorUser().getId().equals(userId);
        boolean isTrainee = memberRepository.existsByRelationship_IdAndTraineeUser_Id(relationshipId, userId);
        if (!isMentor && !isTrainee) {
            throw new AccessDeniedException("You are not a participant in this mentoring relationship.");
        }
        return relationship;
    }

    private void ensureWritableParticipant(MentoringRelationship relationship, Long userId) {
        if (relationship.getStatus() != MentoringRelationshipStatus.ACTIVE) {
            throw new BusinessException(
                    "MENTORING_RELATIONSHIP_READ_ONLY",
                    "Chat is read-only after a mentoring relationship is closed.",
                    HttpStatus.CONFLICT
            );
        }
        boolean isMentor = relationship.getMentorUser().getId().equals(userId);
        boolean activeTrainee = memberRepository.existsByRelationship_IdAndTraineeUser_IdAndStatus(
                relationship.getId(), userId, MentoringRelationshipMemberStatus.ACTIVE
        );
        if (!isMentor && !activeTrainee) {
            throw new AccessDeniedException("Only active relationship participants can send messages.");
        }
    }

    private void validateSession(MentoringSessionRequest body) {
        if (body == null || body.title() == null || body.title().isBlank()) {
            throw new BusinessException("MENTORING_SESSION_TITLE_REQUIRED", "Enter a session title.");
        }
        if (body.title().trim().length() > 180) {
            throw new BusinessException("MENTORING_SESSION_TITLE_TOO_LONG", "Session titles cannot exceed 180 characters.");
        }
        if (body.agenda() != null && body.agenda().length() > 2000) {
            throw new BusinessException("MENTORING_SESSION_AGENDA_TOO_LONG", "Session agendas cannot exceed 2000 characters.");
        }
        if (body.scheduledStart() == null || body.scheduledEnd() == null
                || !body.scheduledStart().isAfter(Instant.now())
                || !body.scheduledEnd().isAfter(body.scheduledStart())) {
            throw new BusinessException(
                    "INVALID_MENTORING_SESSION_TIME",
                    "Choose a future start time and an end time after the start."
            );
        }
        if (body.deliveryMode() == null) {
            throw new BusinessException("MENTORING_DELIVERY_MODE_REQUIRED", "Choose a delivery mode.");
        }
    }

    private String normalizeMeetingUrl(String value) {
        String normalized = normalizeOptionalText(value);
        if (normalized == null) {
            return null;
        }
        try {
            URI uri = URI.create(normalized);
            if (uri.getHost() == null
                    || (!"https".equalsIgnoreCase(uri.getScheme()) && !"http".equalsIgnoreCase(uri.getScheme()))) {
                throw new IllegalArgumentException();
            }
        } catch (IllegalArgumentException exception) {
            throw new BusinessException(
                    "INVALID_MENTORING_MEETING_URL",
                    "Enter a valid HTTP or HTTPS meeting link."
            );
        }
        return normalized;
    }

    private String normalizeOptionalText(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        return value.trim();
    }

    private Map<Long, Employee> loadEmployees(Iterable<Long> userIds) {
        List<Long> ids = new ArrayList<>();
        userIds.forEach(ids::add);
        if (ids.isEmpty()) {
            return Map.of();
        }
        Map<Long, Employee> employees = new LinkedHashMap<>();
        employeeRepository.findDetailedByUserIdIn(ids)
                .forEach(employee -> employees.put(employee.getUserId(), employee));
        return employees;
    }

    private String employeeName(Long userId, String username, Map<Long, Employee> employeesByUserId) {
        Employee employee = employeesByUserId.get(userId);
        return employee == null ? username : employee.getFullName();
    }

    private MentoringSessionDto toSessionDto(
            MentoringSession session,
            Map<Long, Employee> employeesByUserId
    ) {
        User creator = session.getCreatedByUser();
        return new MentoringSessionDto(
                session.getId(),
                session.getRelationship().getId(),
                session.getTitle(),
                session.getAgenda(),
                session.getScheduledStart(),
                session.getScheduledEnd(),
                session.getDeliveryMode(),
                session.getMeetingUrl(),
                session.getStatus(),
                creator.getId(),
                employeeName(creator.getId(), creator.getUsername(), employeesByUserId),
                session.getCreatedAt()
        );
    }

    private MentoringChatMessageDto toMessageDto(
            MentoringMessage message,
            Long currentUserId,
            Map<Long, Employee> employeesByUserId
    ) {
        User sender = message.getSenderUser();
        return new MentoringChatMessageDto(
                message.getId(),
                message.getRelationship().getId(),
                sender.getId(),
                employeeName(sender.getId(), sender.getUsername(), employeesByUserId),
                message.getBody(),
                message.getCreatedAt(),
                sender.getId().equals(currentUserId)
        );
    }
}
