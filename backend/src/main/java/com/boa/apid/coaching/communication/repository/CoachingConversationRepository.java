package com.boa.apid.coaching.communication.repository;

import com.boa.apid.coaching.communication.entity.CoachingConversation;
import com.boa.apid.coaching.communication.entity.ConversationContextType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface CoachingConversationRepository extends JpaRepository<CoachingConversation, Long> {

    Optional<CoachingConversation> findByAssignmentIdAndContextType(Long assignmentId, ConversationContextType contextType);

    Optional<CoachingConversation> findBySkillRequestIdAndContextType(Long skillRequestId, ConversationContextType contextType);

    @Query("""
            SELECT c FROM CoachingConversation c
            WHERE c.skillRequestId = :skillRequestId
              AND c.contextType = 'SKILL_PEER_DIRECT'
              AND c.peerEmployeeAId = :empA
              AND c.peerEmployeeBId = :empB
            """)
    Optional<CoachingConversation> findPeerConversation(
            @Param("skillRequestId") Long skillRequestId,
            @Param("empA") Long empA,
            @Param("empB") Long empB
    );

    @Query("""
            SELECT c FROM CoachingConversation c
            JOIN ConversationParticipant p ON p.conversationId = c.id
            WHERE p.userId = :userId
              AND p.status = 'ACTIVE'
              AND c.status = 'ACTIVE'
            ORDER BY c.updatedAt DESC
            """)
    List<CoachingConversation> findAllActiveForUser(@Param("userId") Long userId);
}
