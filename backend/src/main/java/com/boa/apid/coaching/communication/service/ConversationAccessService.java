package com.boa.apid.coaching.communication.service;

import com.boa.apid.coaching.communication.entity.CoachingConversation;
import com.boa.apid.coaching.communication.entity.ConversationContextType;
import com.boa.apid.coaching.communication.entity.ConversationParticipant;
import com.boa.apid.coaching.communication.entity.ConversationParticipantRole;
import com.boa.apid.coaching.communication.entity.ConversationStatus;
import com.boa.apid.coaching.communication.entity.ParticipantStatus;
import com.boa.apid.coaching.communication.repository.CoachingConversationRepository;
import com.boa.apid.coaching.communication.repository.ConversationParticipantRepository;
import com.boa.apid.coaching.skillrequest.entity.SkillCoachingRequest;
import com.boa.apid.coaching.skillrequest.entity.SkillCoachingRequestStatus;
import com.boa.apid.coaching.skillrequest.entity.SkillCoachingRequestTarget;
import com.boa.apid.coaching.skillrequest.repository.SkillCoachingRequestRepository;
import com.boa.apid.coaching.skillrequest.repository.SkillCoachingRequestTargetRepository;
import com.boa.apid.core.organization.entity.Employee;
import com.boa.apid.core.organization.repository.EmployeeRepository;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.Objects;
import java.util.Optional;

@Service
public class ConversationAccessService {

    private final CoachingConversationRepository conversationRepository;
    private final ConversationParticipantRepository participantRepository;
    private final SkillCoachingRequestRepository skillRequestRepository;
    private final SkillCoachingRequestTargetRepository skillTargetRepository;
    private final EmployeeRepository employeeRepository;

    public ConversationAccessService(
            CoachingConversationRepository conversationRepository,
            ConversationParticipantRepository participantRepository,
            SkillCoachingRequestRepository skillRequestRepository,
            SkillCoachingRequestTargetRepository skillTargetRepository,
            EmployeeRepository employeeRepository
    ) {
        this.conversationRepository = conversationRepository;
        this.participantRepository = participantRepository;
        this.skillRequestRepository = skillRequestRepository;
        this.skillTargetRepository = skillTargetRepository;
        this.employeeRepository = employeeRepository;
    }

    /**
     * Verifies that the caller is an ACTIVE participant in the given conversation.
     * Also checks that the conversation itself is ACTIVE.
     */
    @Transactional(readOnly = true)
    public ConversationParticipant verifyActiveParticipant(Long conversationId, Long userId) {
        CoachingConversation conversation = conversationRepository.findById(conversationId)
                .orElseThrow(() -> new IllegalArgumentException("Conversation not found: " + conversationId));

        if (conversation.getStatus() != ConversationStatus.ACTIVE) {
            throw new AccessDeniedException("This conversation has been archived and is read-only.");
        }

        ConversationParticipant participant = participantRepository.findByConversationIdAndUserId(conversationId, userId)
                .orElseThrow(() -> new AccessDeniedException("Access denied: You are not a participant in this conversation."));

        if (participant.getStatus() != ParticipantStatus.ACTIVE) {
            throw new AccessDeniedException("Access denied: Your active access to this conversation has ended.");
        }

        return participant;
    }

    /**
     * Verifies that the caller can read historical messages (including REMOVED participants for audit).
     */
    @Transactional(readOnly = true)
    public ConversationParticipant verifyParticipantForRead(Long conversationId, Long userId) {
        conversationRepository.findById(conversationId)
                .orElseThrow(() -> new IllegalArgumentException("Conversation not found: " + conversationId));

        return participantRepository.findByConversationIdAndUserId(conversationId, userId)
                .orElseThrow(() -> new AccessDeniedException("Access denied: You are not a participant in this conversation."));
    }

    /**
     * Verifies eligibility for a private peer-to-peer 1-on-1 thread between two employees within an approved skill cohort.
     * Enforces:
     * 1. Skill request must exist and be APPROVED.
     * 2. Caller must resolve to an active employee.
     * 3. Target must be a different active employee.
     * 4. Neither caller nor target can be the assigned Coach (peer chat is strictly employee-to-employee).
     * 5. Both caller and target must be approved members of the cohort.
     */
    @Transactional(readOnly = true)
    public void verifyPeerEligibility(Long skillRequestId, Long callerUserId, Long targetEmployeeId) {
        Employee caller = employeeRepository.findByUserId(callerUserId)
                .orElseThrow(() -> new AccessDeniedException("Caller does not have an associated employee profile."));

        if (Objects.equals(caller.getId(), targetEmployeeId)) {
            throw new IllegalArgumentException("Cannot start a peer conversation with yourself.");
        }

        SkillCoachingRequest request = skillRequestRepository.findById(skillRequestId)
                .orElseThrow(() -> new IllegalArgumentException("Skill coaching request not found: " + skillRequestId));

        if (request.getStatus() != SkillCoachingRequestStatus.APPROVED) {
            throw new AccessDeniedException("Peer communication is only allowed for approved skill development cohorts.");
        }

        // Coach cannot participate in peer chats
        if (Objects.equals(caller.getId(), request.getProposedCoachEmployeeId()) ||
                Objects.equals(targetEmployeeId, request.getProposedCoachEmployeeId())) {
            throw new AccessDeniedException("Coaches cannot participate in coachee peer chats. Use the group channel instead.");
        }

        // Verify both caller and target are in the cohort
        List<SkillCoachingRequestTarget> targets = skillTargetRepository.findAllByRequestId(skillRequestId);
        boolean callerInCohort = targets.stream().anyMatch(t -> Objects.equals(t.getEmployeeId(), caller.getId()));
        boolean targetInCohort = targets.stream().anyMatch(t -> Objects.equals(t.getEmployeeId(), targetEmployeeId));

        if (!callerInCohort) {
            throw new AccessDeniedException("Caller is not a member of this skill cohort.");
        }
        if (!targetInCohort) {
            throw new AccessDeniedException("Target employee is not a member of this skill cohort.");
        }
    }

    /**
     * Safely updates conversation participants when an assignment coach is replaced.
     * The previous coach is preserved with status = REMOVED for message history audit.
     */
    @Transactional
    public void handleCoachReplacement(Long assignmentId, Long oldCoachEmployeeId, Long newCoachEmployeeId, Long adminUserId) {
        Optional<CoachingConversation> convOpt = conversationRepository.findByAssignmentIdAndContextType(
                assignmentId, ConversationContextType.MANDATORY_ASSIGNMENT
        );
        if (convOpt.isEmpty()) {
            return;
        }

        CoachingConversation conversation = convOpt.get();

        // 1. Mark previous coach as REMOVED if present
        if (oldCoachEmployeeId != null) {
            participantRepository.findByConversationIdAndEmployeeId(conversation.getId(), oldCoachEmployeeId)
                    .ifPresent(p -> {
                        p.setStatus(ParticipantStatus.REMOVED);
                        p.setLeftAt(Instant.now());
                        p.setRemovedByUserId(adminUserId);
                        p.setRemovalReason("Coach reassigned for coaching assignment");
                        participantRepository.save(p);
                    });
        }

        // 2. Add or activate new coach
        if (newCoachEmployeeId != null) {
            Optional<ConversationParticipant> existingNewCoach =
                    participantRepository.findByConversationIdAndEmployeeId(conversation.getId(), newCoachEmployeeId);

            if (existingNewCoach.isPresent()) {
                ConversationParticipant p = existingNewCoach.get();
                p.setStatus(ParticipantStatus.ACTIVE);
                p.setRole(ConversationParticipantRole.COACH);
                p.setLeftAt(null);
                participantRepository.save(p);
            } else {
                Employee newCoachEmp = employeeRepository.findById(newCoachEmployeeId)
                        .orElseThrow(() -> new IllegalArgumentException("New coach employee not found: " + newCoachEmployeeId));

                ConversationParticipant newParticipant = new ConversationParticipant(
                        conversation.getId(),
                        newCoachEmployeeId,
                        newCoachEmp.getUserId(),
                        ConversationParticipantRole.COACH
                );
                participantRepository.save(newParticipant);
            }
        }
    }
}
