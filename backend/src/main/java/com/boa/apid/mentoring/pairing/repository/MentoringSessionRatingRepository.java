package com.boa.apid.mentoring.pairing.repository;

import com.boa.apid.mentoring.pairing.entity.MentoringSessionRating;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;

public interface MentoringSessionRatingRepository extends JpaRepository<MentoringSessionRating, Long> {

    Optional<MentoringSessionRating> findBySession_IdAndMenteeUser_Id(Long sessionId, Long menteeUserId);

    @Query("""
            SELECT COUNT(DISTINCT rating.session.id)
            FROM MentoringSessionRating rating
            WHERE rating.session.relationship.mentorUser.id = :mentorUserId
              AND rating.session.status =
                com.boa.apid.mentoring.pairing.entity.MentoringSessionStatus.COMPLETED
            """)
    long countCompletedSessionsWithRatingsByMentorUserId(@Param("mentorUserId") Long mentorUserId);

    @Query("""
            SELECT AVG(rating.rating)
            FROM MentoringSessionRating rating
            WHERE rating.session.relationship.mentorUser.id = :mentorUserId
              AND rating.session.status =
                com.boa.apid.mentoring.pairing.entity.MentoringSessionStatus.COMPLETED
            """)
    Double averageCompletedByMentorUserId(@Param("mentorUserId") Long mentorUserId);
}
