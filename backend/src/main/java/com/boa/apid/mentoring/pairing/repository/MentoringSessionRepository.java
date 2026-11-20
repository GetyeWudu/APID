package com.boa.apid.mentoring.pairing.repository;

import com.boa.apid.mentoring.pairing.entity.MentoringSession;
import com.boa.apid.mentoring.pairing.entity.MentoringSessionStatus;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface MentoringSessionRepository extends JpaRepository<MentoringSession, Long> {

    @EntityGraph(attributePaths = {"createdByUser", "targetTraineeMember", "targetTraineeMember.traineeUser"})
    List<MentoringSession> findByRelationship_IdOrderByScheduledStartDesc(Long relationshipId);

    @EntityGraph(attributePaths = {
            "createdByUser",
            "relationship",
            "targetTraineeMember",
            "targetTraineeMember.traineeUser"
    })
    List<MentoringSession> findByRelationship_IdInOrderByScheduledStartDesc(Collection<Long> relationshipIds);

    long countByStatus(MentoringSessionStatus status);

    long countByRelationship_IdAndStatus(Long relationshipId, MentoringSessionStatus status);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select session from MentoringSession session where session.id = :sessionId")
    Optional<MentoringSession> findByIdForUpdate(@Param("sessionId") Long sessionId);
}
