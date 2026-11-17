package com.boa.apid.mentoring.pairing.repository;

import com.boa.apid.mentoring.pairing.entity.MentoringRelationship;
import com.boa.apid.mentoring.pairing.entity.MentoringRelationshipStatus;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import jakarta.persistence.LockModeType;
import java.util.Optional;
import java.util.List;

public interface MentoringRelationshipRepository extends JpaRepository<MentoringRelationship, Long> {

    Optional<MentoringRelationship> findByRequest_Id(Long requestId);

    @EntityGraph(attributePaths = {"request", "request.skill", "mentorUser"})
    Optional<MentoringRelationship> findDetailedById(Long id);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT relationship FROM MentoringRelationship relationship WHERE relationship.id = :id")
    Optional<MentoringRelationship> findByIdForUpdate(@Param("id") Long id);

    @EntityGraph(attributePaths = {"request", "request.skill", "mentorUser"})
    List<MentoringRelationship> findByStatusOrderByStartedAtDesc(MentoringRelationshipStatus status);

    @EntityGraph(attributePaths = {"request", "request.skill", "mentorUser"})
    List<MentoringRelationship> findAllByOrderByStartedAtDescIdDesc();

    @EntityGraph(attributePaths = {"request", "request.skill", "mentorUser"})
    List<MentoringRelationship> findByMentorUser_IdAndStatus(
            Long mentorUserId,
            MentoringRelationshipStatus status
    );

    long countByStatus(MentoringRelationshipStatus status);

    @Query("""
            SELECT COUNT(member)
            FROM MentoringRelationshipMember member
            JOIN member.relationship relationship
            WHERE relationship.mentorUser.id = :mentorUserId
              AND relationship.status = :relationshipStatus
              AND member.status = com.boa.apid.mentoring.pairing.entity.MentoringRelationshipMemberStatus.ACTIVE
            """)
    long countActiveTraineesByMentorUserId(
            @Param("mentorUserId") Long mentorUserId,
            @Param("relationshipStatus") MentoringRelationshipStatus relationshipStatus
    );

    @Query("""
            SELECT CASE WHEN COUNT(member) > 0 THEN true ELSE false END
            FROM MentoringRelationshipMember member
            JOIN member.relationship relationship
            LEFT JOIN member.skill skill
            WHERE member.mentorUser.id = :mentorUserId
              AND member.traineeUser.id = :traineeUserId
              AND ((:skillId IS NULL AND skill IS NULL) OR skill.id = :skillId)
              AND member.status = com.boa.apid.mentoring.pairing.entity.MentoringRelationshipMemberStatus.ACTIVE
              AND relationship.status = :relationshipStatus
            """)
    boolean existsActivePair(
            @Param("mentorUserId") Long mentorUserId,
            @Param("traineeUserId") Long traineeUserId,
            @Param("skillId") Long skillId,
            @Param("relationshipStatus") MentoringRelationshipStatus relationshipStatus
    );
}
