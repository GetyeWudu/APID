package com.boa.apid.mentoring.pairing.repository;

import com.boa.apid.mentoring.pairing.entity.MentoringRelationshipMember;
import com.boa.apid.mentoring.pairing.entity.MentoringRelationshipMemberStatus;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface MentoringRelationshipMemberRepository extends JpaRepository<MentoringRelationshipMember, Long> {

    @EntityGraph(attributePaths = {
            "relationship",
            "relationship.request",
            "relationship.request.skill",
            "mentorUser",
            "traineeUser"
    })
    @Query("""
            SELECT member
            FROM MentoringRelationshipMember member
            JOIN member.relationship relationship
            WHERE member.mentorUser.id = :userId
               OR member.traineeUser.id = :userId
            ORDER BY relationship.startedAt DESC, member.id DESC
            """)
    List<MentoringRelationshipMember> findVisibleToUser(@Param("userId") Long userId);

    @EntityGraph(attributePaths = {"traineeUser"})
    List<MentoringRelationshipMember> findByRelationship_IdOrderByJoinedAtAsc(Long relationshipId);

    boolean existsByRelationship_IdAndTraineeUser_IdAndStatus(
            Long relationshipId,
            Long traineeUserId,
            MentoringRelationshipMemberStatus status
    );

    boolean existsByRelationship_IdAndTraineeUser_Id(Long relationshipId, Long traineeUserId);
}
