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

    /**
     * Finds all group sessions (is_group_session = true) where the given user is a target
     * via mentoring_session_targets → relationship_member → trainee_user_id.
     */
    @EntityGraph(attributePaths = {"createdByUser", "relationship", "targetTraineeMember"})
    @Query("""
            SELECT DISTINCT s FROM MentoringSession s
            JOIN MentoringSessionTarget t ON t.session.id = s.id
            WHERE s.isGroupSession = true
              AND t.member.traineeUser.id = :userId
            ORDER BY s.scheduledStart DESC
            """)
    List<MentoringSession> findGroupSessionsByTraineeUserId(@Param("userId") Long userId);

    /**
     * Finds all group sessions created by a mentor.
     */
    @EntityGraph(attributePaths = {"createdByUser", "relationship", "targetTraineeMember"})
    @Query("""
            SELECT s FROM MentoringSession s
            WHERE s.isGroupSession = true
              AND s.createdByUser.id = :mentorUserId
            ORDER BY s.scheduledStart DESC
            """)
    List<MentoringSession> findGroupSessionsByMentorUserId(@Param("mentorUserId") Long mentorUserId);
}
