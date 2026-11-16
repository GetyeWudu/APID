package com.boa.apid.mentoring.collaboration.repository;

import com.boa.apid.mentoring.collaboration.entity.MentoringResource;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface MentoringResourceRepository extends JpaRepository<MentoringResource, Long> {

    @EntityGraph(attributePaths = {"file", "uploadedBy"})
    List<MentoringResource> findByRelationship_IdOrderByCreatedAtDesc(Long relationshipId);

    @EntityGraph(attributePaths = {"relationship", "file"})
    Optional<MentoringResource> findDetailedById(Long id);
}
