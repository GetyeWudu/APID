package com.boa.apid.mentoring.pairing.repository;

import com.boa.apid.mentoring.pairing.entity.MentoringMessage;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface MentoringMessageRepository extends JpaRepository<MentoringMessage, Long> {

    @EntityGraph(attributePaths = {"senderUser"})
    List<MentoringMessage> findByRelationship_IdOrderByCreatedAtDesc(
            Long relationshipId,
            Pageable pageable
    );
}
