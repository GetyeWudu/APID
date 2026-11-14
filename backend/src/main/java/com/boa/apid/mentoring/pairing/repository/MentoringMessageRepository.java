package com.boa.apid.mentoring.pairing.repository;

import com.boa.apid.mentoring.pairing.entity.MentoringMessage;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface MentoringMessageRepository extends JpaRepository<MentoringMessage, Long> {

    @EntityGraph(attributePaths = {"senderUser"})
    @Query("""
            SELECT message
            FROM MentoringMessage message
            WHERE message.relationship.id = :relationshipId
            ORDER BY message.createdAt DESC, message.id DESC
            """)
    List<MentoringMessage> findRecentByRelationship(
            @Param("relationshipId") Long relationshipId,
            Pageable pageable
    );
}
