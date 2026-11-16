package com.boa.apid.coaching.communication.repository;

import com.boa.apid.coaching.communication.entity.ConversationParticipant;
import com.boa.apid.coaching.communication.entity.ParticipantStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ConversationParticipantRepository extends JpaRepository<ConversationParticipant, Long> {

    List<ConversationParticipant> findAllByConversationIdAndStatus(Long conversationId, ParticipantStatus status);

    List<ConversationParticipant> findAllByConversationId(Long conversationId);

    Optional<ConversationParticipant> findByConversationIdAndEmployeeId(Long conversationId, Long employeeId);

    Optional<ConversationParticipant> findByConversationIdAndUserId(Long conversationId, Long userId);

    boolean existsByConversationIdAndUserIdAndStatus(Long conversationId, Long userId, ParticipantStatus status);

    boolean existsByConversationIdAndEmployeeIdAndStatus(Long conversationId, Long employeeId, ParticipantStatus status);
}

