package com.boa.apid.mentoring.pairing.repository;

import com.boa.apid.mentoring.pairing.entity.MentoringRelationship;
import com.boa.apid.mentoring.pairing.entity.MentoringRelationshipStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;

public interface MentoringRelationshipRepository extends JpaRepository<MentoringRelationship, Long> {

    Optional<MentoringRelationship> findByRequest_Id(Long requestId);

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
            WHERE member.mentorUser.id = :mentorUserId
              AND member.traineeUser.id = :traineeUserId
              AND member.status = com.boa.apid.mentoring.pairing.entity.MentoringRelationshipMemberStatus.ACTIVE
              AND relationship.status = :relationshipStatus
            """)
    boolean existsActivePair(
            @Param("mentorUserId") Long mentorUserId,
            @Param("traineeUserId") Long traineeUserId,
            @Param("relationshipStatus") MentoringRelationshipStatus relationshipStatus
    );
}
