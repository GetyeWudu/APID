package com.boa.apid.coaching.communication.repository;

import com.boa.apid.coaching.communication.entity.MessageAttachment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface MessageAttachmentRepository extends JpaRepository<MessageAttachment, Long> {

    List<MessageAttachment> findByMessageId(Long messageId);

    List<MessageAttachment> findByMessageIdIn(List<Long> messageIds);

    @Query("SELECT a FROM MessageAttachment a JOIN CoachingMessage m ON a.messageId = m.id WHERE m.conversationId = :conversationId ORDER BY a.createdAt DESC")
    List<MessageAttachment> findAttachmentsByConversationId(@Param("conversationId") Long conversationId);
}

