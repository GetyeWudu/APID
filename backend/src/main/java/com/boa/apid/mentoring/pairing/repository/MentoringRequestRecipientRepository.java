package com.boa.apid.mentoring.pairing.repository;

import com.boa.apid.mentoring.pairing.entity.MentoringRequestRecipient;
import com.boa.apid.mentoring.pairing.entity.MentoringRequestRecipientStatus;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface MentoringRequestRecipientRepository extends JpaRepository<MentoringRequestRecipient, Long> {

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT recipient FROM MentoringRequestRecipient recipient WHERE recipient.id = :id")
    Optional<MentoringRequestRecipient> findByIdForUpdate(@Param("id") Long id);

    @EntityGraph(attributePaths = {
            "request",
            "request.mentorUser",
            "request.initiatedByUser",
            "request.skill",
            "recipientUser",
            "traineeUser"
    })
    @Query("""
            SELECT recipient
            FROM MentoringRequestRecipient recipient
            JOIN recipient.request request
            WHERE recipient.recipientUser.id = :userId
               OR request.initiatedByUser.id = :userId
            ORDER BY request.createdAt DESC, recipient.id DESC
            """)
    List<MentoringRequestRecipient> findVisibleToUser(@Param("userId") Long userId);

    @Query("""
            SELECT CASE WHEN COUNT(recipient) > 0 THEN true ELSE false END
            FROM MentoringRequestRecipient recipient
            WHERE recipient.request.mentorUser.id = :mentorUserId
              AND recipient.traineeUser.id = :traineeUserId
              AND recipient.status = :status
            """)
    boolean existsByMentorTraineeAndStatus(
            @Param("mentorUserId") Long mentorUserId,
            @Param("traineeUserId") Long traineeUserId,
            @Param("status") MentoringRequestRecipientStatus status
    );

    @Query("""
            SELECT COUNT(recipient)
            FROM MentoringRequestRecipient recipient
            WHERE recipient.request.mentorUser.id = :mentorUserId
              AND recipient.status = :status
            """)
    long countByMentorAndStatus(
            @Param("mentorUserId") Long mentorUserId,
            @Param("status") MentoringRequestRecipientStatus status
    );
}
