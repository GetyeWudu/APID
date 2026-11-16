package com.boa.apid.mentoring.collaboration.repository;

import com.boa.apid.mentoring.collaboration.entity.MentoringRelationshipFeedback;
import com.boa.apid.mentoring.collaboration.entity.MentoringRelationshipFeedbackId;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.Optional;

public interface MentoringRelationshipFeedbackRepository
        extends JpaRepository<MentoringRelationshipFeedback, MentoringRelationshipFeedbackId> {

    boolean existsByRelationship_IdAndTraineeEmployee_Id(Long relationshipId, Long traineeEmployeeId);

    @Query("SELECT AVG(feedback.rating) FROM MentoringRelationshipFeedback feedback")
    Double averageRating();

    @Query("""
            SELECT AVG(feedback.rating)
            FROM MentoringRelationshipFeedback feedback
            WHERE feedback.relationship.mentorUser.id = :mentorUserId
            """)
    Double averageRatingByMentorUserId(Long mentorUserId);
}
