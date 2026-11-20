package com.boa.apid.mentoring.collaboration.repository;

import com.boa.apid.mentoring.collaboration.entity.MentoringResource;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface MentoringResourceRepository extends JpaRepository<MentoringResource, Long> {

    @EntityGraph(attributePaths = {"file", "uploadedBy"})
    List<MentoringResource> findByRelationship_IdAndSessionIsNullOrderByCreatedAtDesc(Long relationshipId);

    @EntityGraph(attributePaths = {"file", "uploadedBy"})
    List<MentoringResource> findByRelationship_IdAndSession_IdOrderByCreatedAtDesc(
            Long relationshipId,
            Long sessionId
    );

    @EntityGraph(attributePaths = {
            "relationship",
            "session",
            "session.relationship",
            "session.targetTraineeMember",
            "session.targetTraineeMember.traineeUser",
            "file"
    })
    Optional<MentoringResource> findDetailedById(Long id);
}
