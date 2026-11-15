package com.boa.apid.coaching.communication.repository;

import com.boa.apid.coaching.communication.entity.ConversationReadState;
import com.boa.apid.coaching.communication.entity.ConversationReadStateId;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface ConversationReadStateRepository extends JpaRepository<ConversationReadState, ConversationReadStateId> {

    Optional<ConversationReadState> findByConversationIdAndUserId(Long conversationId, Long userId);
}
