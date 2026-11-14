package com.boa.apid.mentoring.pairing.repository;

import com.boa.apid.mentoring.pairing.entity.MentoringSession;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface MentoringSessionRepository extends JpaRepository<MentoringSession, Long> {

    @EntityGraph(attributePaths = {"createdByUser"})
    List<MentoringSession> findByRelationship_IdOrderByScheduledStartDesc(Long relationshipId);
}
