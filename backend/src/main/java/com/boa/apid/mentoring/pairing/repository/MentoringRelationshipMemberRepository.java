package com.boa.apid.mentoring.pairing.repository;

import com.boa.apid.mentoring.pairing.entity.MentoringRelationshipMember;
import com.boa.apid.mentoring.pairing.entity.MentoringRelationshipMemberStatus;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

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

    @EntityGraph(attributePaths = {"traineeUser", "skill"})
    List<MentoringRelationshipMember> findByRelationship_IdOrderByJoinedAtAsc(Long relationshipId);

    boolean existsByRelationship_IdAndTraineeUser_IdAndStatus(
            Long relationshipId,
            Long traineeUserId,
            MentoringRelationshipMemberStatus status
    );

    Optional<MentoringRelationshipMember> findByRelationship_IdAndTraineeUser_IdAndStatus(
            Long relationshipId,
            Long traineeUserId,
            MentoringRelationshipMemberStatus status
    );

    boolean existsByRelationship_IdAndTraineeUser_Id(Long relationshipId, Long traineeUserId);

    @EntityGraph(attributePaths = {"relationship", "mentorUser", "traineeUser", "skill"})
    @Query("""
            SELECT member
            FROM MentoringRelationshipMember member
            WHERE member.mentorUser.id = :mentorUserId
              AND member.skill.id = :skillId
              AND member.status = com.boa.apid.mentoring.pairing.entity.MentoringRelationshipMemberStatus.ACTIVE
              AND member.relationship.status = com.boa.apid.mentoring.pairing.entity.MentoringRelationshipStatus.ACTIVE
            """)
    List<MentoringRelationshipMember> findActiveByMentorAndSkill(
            @Param("mentorUserId") Long mentorUserId,
            @Param("skillId") Long skillId
    );

    @EntityGraph(attributePaths = {
            "relationship",
            "relationship.request",
            "relationship.request.skill",
            "mentorUser",
            "traineeUser",
            "skill"
    })
    List<MentoringRelationshipMember> findByRelationship_IdInOrderByJoinedAtAsc(
            Collection<Long> relationshipIds
    );

    /**
     * Finds the active member record for a specific mentor-trainee pair
     * in any active INDIVIDUAL relationship. Used when creating group sessions.
     */
    @EntityGraph(attributePaths = {"relationship", "relationship.request", "traineeUser"})
    @Query("""
            SELECT m FROM MentoringRelationshipMember m
            WHERE m.mentorUser.id = :mentorUserId
              AND m.traineeUser.id = :traineeUserId
              AND m.status = com.boa.apid.mentoring.pairing.entity.MentoringRelationshipMemberStatus.ACTIVE
              AND m.relationship.status = com.boa.apid.mentoring.pairing.entity.MentoringRelationshipStatus.ACTIVE
              AND m.relationship.request.requestType = com.boa.apid.mentoring.pairing.entity.MentoringRequestType.INDIVIDUAL
            """)
    java.util.Optional<MentoringRelationshipMember> findActiveIndividualMemberByMentorAndTrainee(
            @Param("mentorUserId") Long mentorUserId,
            @Param("traineeUserId") Long traineeUserId
    );
}
