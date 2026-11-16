package com.boa.apid.coaching.communication.service;

import com.boa.apid.coaching.communication.dto.*;
import com.boa.apid.coaching.communication.entity.*;
import com.boa.apid.coaching.communication.repository.*;
import com.boa.apid.coaching.skillrequest.entity.SkillCoachingRequest;
import com.boa.apid.coaching.skillrequest.entity.SkillCoachingRequestStatus;
import com.boa.apid.coaching.skillrequest.entity.SkillCoachingRequestTarget;
import com.boa.apid.coaching.skillrequest.repository.SkillCoachingRequestRepository;
import com.boa.apid.coaching.skillrequest.repository.SkillCoachingRequestTargetRepository;
import com.boa.apid.core.organization.entity.Employee;
import com.boa.apid.core.organization.repository.EmployeeRepository;
import com.boa.apid.mentoring.pairing.entity.MentoringRelationship;
import com.boa.apid.mentoring.pairing.entity.MentoringRelationshipMember;
import com.boa.apid.mentoring.pairing.entity.MentoringRelationshipMemberStatus;
import com.boa.apid.mentoring.pairing.entity.MentoringRelationshipStatus;
import com.boa.apid.mentoring.pairing.repository.MentoringRelationshipMemberRepository;
import com.boa.apid.mentoring.pairing.repository.MentoringRelationshipRepository;
import org.springframework.data.domain.PageRequest;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.*;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
public class CoachingCommunicationService {

    private final CoachingConversationRepository conversationRepository;
    private final ConversationParticipantRepository participantRepository;
    private final CoachingMessageRepository messageRepository;
    private final MessageAttachmentRepository attachmentRepository;
    private final ConversationReadStateRepository readStateRepository;
    private final ConversationAccessService accessService;
    private final EmployeeRepository employeeRepository;
    private final SkillCoachingRequestRepository skillRequestRepository;
    private final SkillCoachingRequestTargetRepository skillTargetRepository;
    private final MentoringRelationshipRepository mentoringRelationshipRepository;
    private final MentoringRelationshipMemberRepository mentoringRelationshipMemberRepository;

    public CoachingCommunicationService(
            CoachingConversationRepository conversationRepository,
            ConversationParticipantRepository participantRepository,
            CoachingMessageRepository messageRepository,
            MessageAttachmentRepository attachmentRepository,
            ConversationReadStateRepository readStateRepository,
            ConversationAccessService accessService,
            EmployeeRepository employeeRepository,
            SkillCoachingRequestRepository skillRequestRepository,
            SkillCoachingRequestTargetRepository skillTargetRepository,
            MentoringRelationshipRepository mentoringRelationshipRepository,
            MentoringRelationshipMemberRepository mentoringRelationshipMemberRepository
    ) {
        this.conversationRepository = conversationRepository;
        this.participantRepository = participantRepository;
        this.messageRepository = messageRepository;
        this.attachmentRepository = attachmentRepository;
        this.readStateRepository = readStateRepository;
        this.accessService = accessService;
        this.employeeRepository = employeeRepository;
        this.skillRequestRepository = skillRequestRepository;
        this.skillTargetRepository = skillTargetRepository;
        this.mentoringRelationshipRepository = mentoringRelationshipRepository;
        this.mentoringRelationshipMemberRepository = mentoringRelationshipMemberRepository;
    }

    /**
     * Lists active conversations for the authenticated user, complete with unread counts and latest message snippets.
     */
    @Transactional(readOnly = true)
    public List<ConversationSummaryDto> getMyConversations(Long userId) {
        List<CoachingConversation> conversations = conversationRepository.findAllActiveForUser(userId);
        if (conversations.isEmpty()) {
            return Collections.emptyList();
        }

        return conversations.stream()
                .map(conv -> buildConversationSummary(conv, userId))
                .sorted(Comparator.comparing(
                        ConversationSummaryDto::getUpdatedAt,
                        Comparator.nullsLast(Comparator.reverseOrder())
                ))
                .collect(Collectors.toList());
    }

    /**
     * Retrieves detailed information about a single conversation.
     */
    @Transactional(readOnly = true)
    public ConversationSummaryDto getConversationDetails(Long conversationId, Long userId) {
        accessService.verifyParticipantForRead(conversationId, userId);
        CoachingConversation conversation = conversationRepository.findById(conversationId)
                .orElseThrow(() -> new IllegalArgumentException("Conversation not found: " + conversationId));
        return buildConversationSummary(conversation, userId);
    }

    /**
     * Loads messages for a conversation with cursor pagination and incremental sync support.
     * If afterId is provided, returns all messages newer than afterId (incremental polling / sync).
     * If beforeId is provided, loads an older page of messages.
     * Otherwise, loads the most recent limit messages.
     * Results are returned in chronological order (oldest to newest).
     */
    @Transactional(readOnly = true)
    public List<MessageDto> getMessages(Long conversationId, Long beforeId, Long afterId, int limit, Long userId) {
        accessService.verifyParticipantForRead(conversationId, userId);

        int pageSize = Math.min(Math.max(limit, 1), 100);
        List<CoachingMessage> rawMessages;

        if (afterId != null && afterId > 0) {
            rawMessages = messageRepository.findByConversationIdAndIdGreaterThanOrderByIdAsc(conversationId, afterId);
        } else if (beforeId != null && beforeId > 0) {
            rawMessages = messageRepository.findByConversationIdAndIdLessThanOrderByIdDesc(
                    conversationId, beforeId, PageRequest.of(0, pageSize)
            );
            // Reverse so they are ascending
            Collections.reverse(rawMessages);
        } else {
            rawMessages = messageRepository.findByConversationIdOrderByIdDesc(
                    conversationId, PageRequest.of(0, pageSize)
            );
            // Reverse so they are ascending
            Collections.reverse(rawMessages);
        }

        if (rawMessages.isEmpty()) {
            return Collections.emptyList();
        }

        return mapMessagesToDtos(rawMessages, conversationId);
    }

    /**
     * Sends a message into a conversation.
     * Validates participant status, guards reply integrity, attaches files, and updates read state.
     */
    @Transactional
    public MessageDto sendMessage(Long conversationId, SendMessageRequest request, Long userId) {
        ConversationParticipant participant = accessService.verifyActiveParticipant(conversationId, userId);

        // Deduplication check via clientMessageId
        if (request.getClientMessageId() != null && !request.getClientMessageId().isBlank()) {
            Optional<CoachingMessage> existing = messageRepository.findByConversationIdAndClientMessageId(
                    conversationId, request.getClientMessageId()
            );
            if (existing.isPresent()) {
                return mapSingleMessageToDto(existing.get(), conversationId);
            }
        }

        // Reply verification
        if (request.getReplyToMessageId() != null) {
            CoachingMessage replyTarget = messageRepository.findById(request.getReplyToMessageId())
                    .orElseThrow(() -> new IllegalArgumentException("Reply target message not found: " + request.getReplyToMessageId()));
            if (!Objects.equals(replyTarget.getConversationId(), conversationId)) {
                throw new IllegalArgumentException("Cross-conversation reply is not permitted.");
            }
        }

        CoachingMessage message = new CoachingMessage();
        message.setConversationId(conversationId);
        message.setSenderEmployeeId(participant.getEmployeeId());
        message.setSenderUserId(userId);
        message.setMessageType(request.getMessageType() != null ? request.getMessageType() : MessageType.TEXT);
        message.setContent(request.getContent() != null ? request.getContent().trim() : "");
        message.setClientMessageId(request.getClientMessageId());
        message.setReplyToMessageId(request.getReplyToMessageId());

        CoachingMessage savedMessage = messageRepository.save(message);

        // Attach pre-uploaded files
        if (request.getAttachmentIds() != null && !request.getAttachmentIds().isEmpty()) {
            List<MessageAttachment> attachments = attachmentRepository.findAllById(request.getAttachmentIds());
            for (MessageAttachment att : attachments) {
                att.setMessageId(savedMessage.getId());
                attachmentRepository.save(att);
            }
        }

        // Update conversation timestamp
        conversationRepository.findById(conversationId).ifPresent(c -> {
            c.setUpdatedAt(Instant.now());
            conversationRepository.save(c);
        });

        // Automatically advance the sender's read marker to this message
        markRead(conversationId, savedMessage.getId(), userId);

        return mapSingleMessageToDto(savedMessage, conversationId);
    }

    /**
     * Updates the last read message pointer for a user in a conversation.
     */
    @Transactional
    public void markRead(Long conversationId, Long messageId, Long userId) {
        accessService.verifyParticipantForRead(conversationId, userId);

        ConversationReadState readState = readStateRepository.findByConversationIdAndUserId(conversationId, userId)
                .orElse(null);

        if (readState == null) {
            readState = new ConversationReadState(conversationId, userId, messageId);
            readStateRepository.save(readState);
        } else if (messageId != null && (readState.getLastReadMessageId() == null || messageId > readState.getLastReadMessageId())) {
            readState.setLastReadMessageId(messageId);
            readState.setLastReadAt(Instant.now());
            readStateRepository.save(readState);
        }
    }

    /**
     * Toggles the pinned status of a message.
     * Only coaches or administrators are allowed to pin or unpin messages.
     */
    @Transactional
    public MessageDto togglePinMessage(Long conversationId, Long messageId, Long userId) {
        ConversationParticipant participant = accessService.verifyActiveParticipant(conversationId, userId);
        if (participant.getRole() != ConversationParticipantRole.COACH) {
            throw new AccessDeniedException("Only the assigned coach can pin or unpin messages.");
        }

        CoachingMessage message = messageRepository.findById(messageId)
                .orElseThrow(() -> new IllegalArgumentException("Message not found: " + messageId));
        if (!Objects.equals(message.getConversationId(), conversationId)) {
            throw new IllegalArgumentException("Message does not belong to the specified conversation.");
        }

        boolean willBePinned = !message.isPinned();
        message.setPinned(willBePinned);
        message.setPinnedByUserId(willBePinned ? userId : null);
        message.setPinnedAt(willBePinned ? Instant.now() : null);

        CoachingMessage updated = messageRepository.save(message);
        return mapSingleMessageToDto(updated, conversationId);
    }

    /**
     * Resolves or provisions a private peer-to-peer 1-on-1 direct conversation between two employees in an approved skill cohort.
     */
    @Transactional
    public ConversationSummaryDto getOrCreatePeerConversation(Long skillRequestId, Long targetEmployeeId, Long callerUserId) {
        accessService.verifyPeerEligibility(skillRequestId, callerUserId, targetEmployeeId);

        Employee caller = employeeRepository.findByUserId(callerUserId)
                .orElseThrow(() -> new AccessDeniedException("Caller employee record not found."));
        Employee target = employeeRepository.findById(targetEmployeeId)
                .orElseThrow(() -> new IllegalArgumentException("Target employee not found: " + targetEmployeeId));

        Long empA = Math.min(caller.getId(), target.getId());
        Long empB = Math.max(caller.getId(), target.getId());

        SkillCoachingRequest request = skillRequestRepository.findById(skillRequestId)
                .orElseThrow(() -> new IllegalArgumentException("Skill coaching request not found: " + skillRequestId));

        Optional<CoachingConversation> existing = conversationRepository.findPeerConversation(skillRequestId, empA, empB);
        if (existing.isPresent()) {
            return buildConversationSummary(existing.get(), callerUserId);
        }

        // Create new direct peer conversation
        CoachingConversation conv = new CoachingConversation();
        conv.setConversationType(ConversationType.DIRECT);
        conv.setContextType(ConversationContextType.SKILL_PEER_DIRECT);
        conv.setSkillRequestId(skillRequestId);
        conv.setPeerEmployeeAId(empA);
        conv.setPeerEmployeeBId(empB);
        conv.setTitle("Peer Chat: " + caller.getFullName() + " & " + target.getFullName() + " (" + request.getSkillTitle() + ")");
        conv.setStatus(ConversationStatus.ACTIVE);
        conv.setCreatedByUserId(callerUserId);

        CoachingConversation saved = conversationRepository.save(conv);

        // Add both participants with PEER role
        ConversationParticipant partA = new ConversationParticipant(
                saved.getId(), caller.getId(), caller.getUserId(), ConversationParticipantRole.PEER
        );
        ConversationParticipant partB = new ConversationParticipant(
                saved.getId(), target.getId(), target.getUserId(), ConversationParticipantRole.PEER
        );
        participantRepository.save(partA);
        participantRepository.save(partB);

        return buildConversationSummary(saved, callerUserId);
    }

    /**
     * Provisions a shared group conversation for an approved skill-development cohort.
     */
    @Transactional
    public CoachingConversation provisionSkillCohortGroupConversation(Long skillRequestId, Long adminUserId) {
        Optional<CoachingConversation> existing = conversationRepository.findBySkillRequestIdAndContextType(
                skillRequestId, ConversationContextType.SKILL_COHORT_GROUP
        );
        if (existing.isPresent()) {
            return existing.get();
        }

        SkillCoachingRequest request = skillRequestRepository.findById(skillRequestId)
                .orElseThrow(() -> new IllegalArgumentException("Skill coaching request not found: " + skillRequestId));

        if (request.getStatus() != SkillCoachingRequestStatus.APPROVED) {
            throw new IllegalStateException("Cannot provision group conversation for non-approved skill request.");
        }

        CoachingConversation conv = new CoachingConversation();
        conv.setConversationType(ConversationType.GROUP);
        conv.setContextType(ConversationContextType.SKILL_COHORT_GROUP);
        conv.setSkillRequestId(skillRequestId);
        conv.setTitle("Skill Cohort: " + request.getSkillTitle());
        conv.setStatus(ConversationStatus.ACTIVE);
        conv.setCreatedByUserId(adminUserId);

        CoachingConversation savedConv = conversationRepository.save(conv);

        // 1. Add proposed Coach
        if (request.getProposedCoachEmployeeId() != null) {
            employeeRepository.findById(request.getProposedCoachEmployeeId()).ifPresent(coachEmp -> {
                ConversationParticipant coachParticipant = new ConversationParticipant(
                        savedConv.getId(),
                        coachEmp.getId(),
                        coachEmp.getUserId(),
                        ConversationParticipantRole.COACH
                );
                participantRepository.save(coachParticipant);
            });
        }

        // 2. Add all approved coachees from targets
        List<SkillCoachingRequestTarget> targets = skillTargetRepository.findAllByRequestId(skillRequestId);
        for (SkillCoachingRequestTarget target : targets) {
            employeeRepository.findById(target.getEmployeeId()).ifPresent(emp -> {
                ConversationParticipant coacheeParticipant = new ConversationParticipant(
                        savedConv.getId(),
                        emp.getId(),
                        emp.getUserId(),
                        ConversationParticipantRole.COACHEE
                );
                participantRepository.save(coacheeParticipant);
            });
        }

        return savedConv;
    }

    /**
     * Provisions or ensures a direct 1-on-1 conversation exists for a mandatory coaching assignment.
     */
    @Transactional
    public CoachingConversation ensureMandatoryAssignmentConversation(
            Long assignmentId, Long coachEmployeeId, Long coacheeEmployeeId, Long createdByUserId
    ) {
        Optional<CoachingConversation> existing = conversationRepository.findByAssignmentIdAndContextType(
                assignmentId, ConversationContextType.MANDATORY_ASSIGNMENT
        );
        if (existing.isPresent()) {
            return existing.get();
        }

        Employee coachee = coacheeEmployeeId != null ? employeeRepository.findById(coacheeEmployeeId).orElse(null) : null;
        String title = coachee != null ? "Coaching Discussion — " + coachee.getFullName() : "Mandatory Coaching Discussion";

        CoachingConversation conv = new CoachingConversation();
        conv.setConversationType(ConversationType.DIRECT);
        conv.setContextType(ConversationContextType.MANDATORY_ASSIGNMENT);
        conv.setAssignmentId(assignmentId);
        conv.setTitle(title);
        conv.setStatus(ConversationStatus.ACTIVE);
        conv.setCreatedByUserId(createdByUserId);

        CoachingConversation saved = conversationRepository.save(conv);

        if (coachEmployeeId != null) {
            employeeRepository.findById(coachEmployeeId).ifPresent(coach -> {
                ConversationParticipant p = new ConversationParticipant(
                        saved.getId(), coach.getId(), coach.getUserId(), ConversationParticipantRole.COACH
                );
                participantRepository.save(p);
            });
        }

        if (coacheeEmployeeId != null) {
            employeeRepository.findById(coacheeEmployeeId).ifPresent(coacheeEmp -> {
                ConversationParticipant p = new ConversationParticipant(
                        saved.getId(), coacheeEmp.getId(), coacheeEmp.getUserId(), ConversationParticipantRole.COACHEE
                );
                participantRepository.save(p);
            });
        }

        return saved;
    }

    /**
     * Finds or auto-provisions a direct 1:1 conversation for a MentoringRelationship.
     */
    @Transactional
    public ConversationSummaryDto getOrCreateMentoringRelationshipConversation(Long relationshipId, Long userId) {
        Optional<CoachingConversation> existing = conversationRepository.findByMentoringRelationshipIdAndContextType(
                relationshipId, ConversationContextType.MENTORING_RELATIONSHIP_DIRECT
        );

        if (existing.isPresent()) {
            accessService.verifyParticipantForRead(existing.get().getId(), userId);
            return buildConversationSummary(existing.get(), userId);
        }

        MentoringRelationship relationship = mentoringRelationshipRepository.findById(relationshipId)
                .orElseThrow(() -> new IllegalArgumentException("Mentoring relationship not found: " + relationshipId));

        if (relationship.getStatus() != MentoringRelationshipStatus.ACTIVE) {
            throw new IllegalStateException("Cannot start chat on an inactive mentoring relationship.");
        }

        List<MentoringRelationshipMember> members = mentoringRelationshipMemberRepository.findByRelationship_IdOrderByJoinedAtAsc(relationshipId);
        if (members.isEmpty()) {
            throw new IllegalStateException("Mentoring relationship has no assigned trainees.");
        }

        // Mentor employee
        Employee mentorEmp = employeeRepository.findByUserId(relationship.getMentorUser().getId())
                .orElseThrow(() -> new IllegalStateException("Mentor does not have a linked employee profile."));

        // Primary trainee employee
        MentoringRelationshipMember primaryMember = members.get(0);
        Employee traineeEmp = employeeRepository.findByUserId(primaryMember.getTraineeUser().getId())
                .orElseThrow(() -> new IllegalStateException("Trainee does not have a linked employee profile."));

        CoachingConversation conv = new CoachingConversation();
        conv.setConversationType(ConversationType.DIRECT);
        conv.setContextType(ConversationContextType.MENTORING_RELATIONSHIP_DIRECT);
        conv.setMentoringRelationshipId(relationshipId);
        conv.setSkillId(primaryMember.getSkill() != null ? primaryMember.getSkill().getId() : null);
        conv.setTitle("Mentoring · " + mentorEmp.getFullName() + " & " + traineeEmp.getFullName());
        conv.setStatus(ConversationStatus.ACTIVE);
        conv.setCreatedByUserId(userId);

        CoachingConversation savedConv = conversationRepository.save(conv);

        // Add Trainer participant
        ConversationParticipant trainerParticipant = new ConversationParticipant(
                savedConv.getId(),
                mentorEmp.getId(),
                relationship.getMentorUser().getId(),
                ConversationParticipantRole.TRAINER
        );
        participantRepository.save(trainerParticipant);

        // Add Trainee participants (all active trainees in this relationship)
        for (MentoringRelationshipMember member : members) {
            if (member.getStatus() == MentoringRelationshipMemberStatus.ACTIVE) {
                employeeRepository.findByUserId(member.getTraineeUser().getId()).ifPresent(tEmp -> {
                    ConversationParticipant traineeParticipant = new ConversationParticipant(
                            savedConv.getId(),
                            tEmp.getId(),
                            member.getTraineeUser().getId(),
                            ConversationParticipantRole.TRAINEE
                    );
                    participantRepository.save(traineeParticipant);
                });
            }
        }

        accessService.verifyParticipantForRead(savedConv.getId(), userId);
        return buildConversationSummary(savedConv, userId);
    }

    /**
     * Creates or returns a private 1:1 peer conversation between two trainees in the same mentoring relationship.
     */
    @Transactional
    public ConversationSummaryDto createMentoringPeerConversation(Long relationshipId, Long requestingUserId, Long targetEmployeeId) {
        Employee requestingEmp = employeeRepository.findByUserId(requestingUserId)
                .orElseThrow(() -> new IllegalStateException("Requesting user does not have a linked employee record."));

        if (Objects.equals(requestingEmp.getId(), targetEmployeeId)) {
            throw new IllegalArgumentException("Cannot create a peer conversation with yourself.");
        }

        Employee targetEmp = employeeRepository.findById(targetEmployeeId)
                .orElseThrow(() -> new IllegalArgumentException("Target employee not found: " + targetEmployeeId));

        if (targetEmp.getUserId() == null) {
            throw new IllegalStateException("Target employee does not have an active user account.");
        }

        // Verify both trainees belong to this mentoring relationship
        boolean requesterInRel = mentoringRelationshipMemberRepository.existsByRelationship_IdAndTraineeUser_Id(
                relationshipId, requestingUserId
        );
        boolean targetInRel = mentoringRelationshipMemberRepository.existsByRelationship_IdAndTraineeUser_Id(
                relationshipId, targetEmp.getUserId()
        );

        if (!requesterInRel || !targetInRel) {
            throw new AccessDeniedException("Peer conversations are only allowed between trainees sharing the same mentoring relationship.");
        }

        long empA = Math.min(requestingEmp.getId(), targetEmp.getId());
        long empB = Math.max(requestingEmp.getId(), targetEmp.getId());

        Optional<CoachingConversation> existing = conversationRepository.findMentoringPeerConversation(relationshipId, empA, empB);
        if (existing.isPresent()) {
            return buildConversationSummary(existing.get(), requestingUserId);
        }

        CoachingConversation conv = new CoachingConversation();
        conv.setConversationType(ConversationType.DIRECT);
        conv.setContextType(ConversationContextType.MENTORING_PEER_DIRECT);
        conv.setMentoringRelationshipId(relationshipId);
        conv.setPeerEmployeeAId(empA);
        conv.setPeerEmployeeBId(empB);
        conv.setTitle("Mentoring Peer Chat · " + requestingEmp.getFullName() + " & " + targetEmp.getFullName());
        conv.setStatus(ConversationStatus.ACTIVE);
        conv.setCreatedByUserId(requestingUserId);

        CoachingConversation saved = conversationRepository.save(conv);

        // Add both as PEER participants
        participantRepository.save(new ConversationParticipant(saved.getId(), requestingEmp.getId(), requestingUserId, ConversationParticipantRole.PEER));
        participantRepository.save(new ConversationParticipant(saved.getId(), targetEmp.getId(), targetEmp.getUserId(), ConversationParticipantRole.PEER));

        return buildConversationSummary(saved, requestingUserId);
    }

    // ==========================================
    // Mapping & Helper Methods
    // ==========================================

    private ConversationSummaryDto buildConversationSummary(CoachingConversation conv, Long userId) {
        ConversationSummaryDto dto = new ConversationSummaryDto();
        dto.setId(conv.getId());
        dto.setConversationType(conv.getConversationType());
        dto.setContextType(conv.getContextType());
        dto.setAssignmentId(conv.getAssignmentId());
        dto.setSkillRequestId(conv.getSkillRequestId());
        dto.setMentoringRelationshipId(conv.getMentoringRelationshipId());
        dto.setSkillId(conv.getSkillId());
        dto.setPeerEmployeeAId(conv.getPeerEmployeeAId());
        dto.setPeerEmployeeBId(conv.getPeerEmployeeBId());
        dto.setTitle(conv.getTitle());
        dto.setStatus(conv.getStatus());
        dto.setUpdatedAt(conv.getUpdatedAt());

        // Participants
        List<ConversationParticipant> participants = participantRepository.findAllByConversationId(conv.getId());
        List<Long> empIds = participants.stream().map(ConversationParticipant::getEmployeeId).collect(Collectors.toList());
        Map<Long, Employee> empMap = employeeRepository.findAllById(empIds).stream()
                .collect(Collectors.toMap(Employee::getId, Function.identity(), (a, b) -> a));

        List<ParticipantDto> participantDtos = participants.stream().map(p -> {
            ParticipantDto pd = new ParticipantDto();
            pd.setId(p.getId());
            pd.setEmployeeId(p.getEmployeeId());
            pd.setUserId(p.getUserId());
            pd.setRole(p.getRole());
            pd.setStatus(p.getStatus());
            pd.setJoinedAt(p.getJoinedAt());
            pd.setLeftAt(p.getLeftAt());

            Employee emp = empMap.get(p.getEmployeeId());
            if (emp != null) {
                pd.setEmployeeNumber(emp.getEmployeeNumber());
                pd.setFullName(emp.getFullName());
                pd.setEmail(emp.getEmail());
                pd.setJobTitle(emp.getJob());
            }
            return pd;
        }).collect(Collectors.toList());
        dto.setParticipants(participantDtos);

        // Read state & unread count
        Long lastReadMessageId = readStateRepository.findByConversationIdAndUserId(conv.getId(), userId)
                .map(ConversationReadState::getLastReadMessageId)
                .orElse(null);

        long unreadCount = messageRepository.countUnreadMessages(conv.getId(), lastReadMessageId, userId);
        dto.setUnreadCount(unreadCount);

        // Latest message snippet
        messageRepository.findTopByConversationIdOrderByIdDesc(conv.getId()).ifPresent(lastMsg -> {
            dto.setLastMessageAt(lastMsg.getCreatedAt());
            if (lastMsg.isDeleted()) {
                dto.setLastMessageSnippet("This message was deleted.");
            } else if (lastMsg.getMessageType() == MessageType.FILE) {
                dto.setLastMessageSnippet("Shared an attachment");
            } else {
                String content = lastMsg.getContent() != null ? lastMsg.getContent() : "";
                dto.setLastMessageSnippet(content.length() > 60 ? content.substring(0, 57) + "..." : content);
            }
            Employee sender = empMap.get(lastMsg.getSenderEmployeeId());
            dto.setLastMessageSenderName(sender != null ? sender.getFullName() : "Participant");
        });

        // Pinned messages
        List<CoachingMessage> pinned = messageRepository.findByConversationIdAndIsPinnedTrueAndIsDeletedFalseOrderByPinnedAtDesc(conv.getId());
        if (!pinned.isEmpty()) {
            dto.setPinnedMessages(mapMessagesToDtos(pinned, conv.getId()));
        }

        return dto;
    }

    private List<MessageDto> mapMessagesToDtos(List<CoachingMessage> messages, Long conversationId) {
        if (messages.isEmpty()) {
            return Collections.emptyList();
        }

        List<Long> msgIds = messages.stream().map(CoachingMessage::getId).collect(Collectors.toList());
        List<Long> senderEmpIds = messages.stream().map(CoachingMessage::getSenderEmployeeId).distinct().collect(Collectors.toList());
        Map<Long, Employee> empMap = employeeRepository.findAllById(senderEmpIds).stream()
                .collect(Collectors.toMap(Employee::getId, Function.identity(), (a, b) -> a));

        Map<Long, ConversationParticipant> participantMap = participantRepository.findAllByConversationId(conversationId).stream()
                .collect(Collectors.toMap(ConversationParticipant::getEmployeeId, Function.identity(), (a, b) -> a));

        List<MessageAttachment> allAttachments = attachmentRepository.findByMessageIdIn(msgIds);
        Map<Long, List<AttachmentDto>> attachmentMap = allAttachments.stream()
                .map(this::mapAttachmentToDto)
                .collect(Collectors.groupingBy(AttachmentDto::getMessageId));

        // Reply targets lookup
        List<Long> replyIds = messages.stream()
                .map(CoachingMessage::getReplyToMessageId)
                .filter(Objects::nonNull)
                .distinct()
                .collect(Collectors.toList());

        Map<Long, CoachingMessage> replyTargetMap = replyIds.isEmpty() ? Collections.emptyMap() :
                messageRepository.findAllById(replyIds).stream()
                        .collect(Collectors.toMap(CoachingMessage::getId, Function.identity(), (a, b) -> a));

        return messages.stream().map(m -> {
            MessageDto md = new MessageDto();
            md.setId(m.getId());
            md.setConversationId(m.getConversationId());
            md.setSenderEmployeeId(m.getSenderEmployeeId());
            md.setSenderUserId(m.getSenderUserId());
            md.setMessageType(m.getMessageType());
            md.setContent(m.isDeleted() ? "This message was deleted." : m.getContent());
            md.setClientMessageId(m.getClientMessageId());
            md.setReplyToMessageId(m.getReplyToMessageId());
            md.setPinned(m.isPinned());
            md.setPinnedAt(m.getPinnedAt());
            md.setDeleted(m.isDeleted());
            md.setCreatedAt(m.getCreatedAt());

            Employee sender = empMap.get(m.getSenderEmployeeId());
            if (sender != null) {
                md.setSenderName(sender.getFullName());
            }
            ConversationParticipant part = participantMap.get(m.getSenderEmployeeId());
            if (part != null) {
                md.setSenderRole(part.getRole());
            }

            // Reply snippet
            if (m.getReplyToMessageId() != null) {
                CoachingMessage rep = replyTargetMap.get(m.getReplyToMessageId());
                if (rep != null) {
                    Employee repSender = empMap.get(rep.getSenderEmployeeId());
                    md.setReplyToSenderName(repSender != null ? repSender.getFullName() : "Participant");
                    String repContent = rep.getContent() != null ? rep.getContent() : "";
                    md.setReplyToSnippet(repContent.length() > 50 ? repContent.substring(0, 47) + "..." : repContent);
                }
            }

            md.setAttachments(attachmentMap.getOrDefault(m.getId(), Collections.emptyList()));
            return md;
        }).collect(Collectors.toList());
    }

    private MessageDto mapSingleMessageToDto(CoachingMessage message, Long conversationId) {
        return mapMessagesToDtos(List.of(message), conversationId).get(0);
    }

    private AttachmentDto mapAttachmentToDto(MessageAttachment att) {
        AttachmentDto ad = new AttachmentDto();
        ad.setId(att.getId());
        ad.setMessageId(att.getMessageId());
        ad.setFileName(att.getFileName());
        ad.setMimeType(att.getMimeType());
        ad.setFileSizeBytes(att.getFileSizeBytes());
        ad.setScanStatus(att.getScanStatus());
        ad.setCreatedAt(att.getCreatedAt());
        ad.setDownloadUrl("/api/v1/coaching/conversations/attachments/" + att.getId());
        return ad;
    }
}
