package com.boa.apid.coaching.communication.repository;

import com.boa.apid.coaching.communication.entity.CoachingMessage;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface CoachingMessageRepository extends JpaRepository<CoachingMessage, Long> {

    // Cursor pagination (history: loading older messages before a specific ID)
    List<CoachingMessage> findByConversationIdAndIdLessThanOrderByIdDesc(Long conversationId, Long beforeId, Pageable pageable);

    // Initial message load (latest N messages)
    List<CoachingMessage> findByConversationIdOrderByIdDesc(Long conversationId, Pageable pageable);

    // Incremental polling / live sync (newer messages after a specific ID)
    List<CoachingMessage> findByConversationIdAndIdGreaterThanOrderByIdAsc(Long conversationId, Long afterId);

    // Top latest message for conversation summary snippet
    Optional<CoachingMessage> findTopByConversationIdOrderByIdDesc(Long conversationId);

    // Unread count: messages in conversation newer than lastReadMessageId that are not from this sender
    @Query("SELECT COUNT(m) FROM CoachingMessage m WHERE m.conversationId = :conversationId AND (:lastReadMessageId IS NULL OR m.id > :lastReadMessageId) AND m.senderUserId <> :userId AND m.isDeleted = false")
    long countUnreadMessages(
            @Param("conversationId") Long conversationId,
            @Param("lastReadMessageId") Long lastReadMessageId,
            @Param("userId") Long userId
    );

    // Idempotency check with client_message_id
    Optional<CoachingMessage> findByConversationIdAndClientMessageId(Long conversationId, String clientMessageId);

    // Pinned messages for quick reference banner
    List<CoachingMessage> findByConversationIdAndIsPinnedTrueAndIsDeletedFalseOrderByPinnedAtDesc(Long conversationId);
}

