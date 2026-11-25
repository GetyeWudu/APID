package com.boa.apid.mentoring.collaboration.repository;

import com.boa.apid.mentoring.collaboration.dto.MentoringFeedbackRatingEntry;
import com.boa.apid.mentoring.collaboration.entity.MentoringRelationshipFeedback;
import com.boa.apid.mentoring.collaboration.entity.MentoringRelationshipFeedbackId;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;

public interface MentoringRelationshipFeedbackRepository
        extends JpaRepository<MentoringRelationshipFeedback, MentoringRelationshipFeedbackId> {

    boolean existsByRelationship_IdAndTraineeEmployee_Id(Long relationshipId, Long traineeEmployeeId);

    @Query("""
            SELECT new com.boa.apid.mentoring.collaboration.dto.MentoringFeedbackRatingEntry(
                feedback.rating,
                feedback.ratedAt
            )
            FROM MentoringRelationshipFeedback feedback
            """)
    List<MentoringFeedbackRatingEntry> findAllRatingEntries();

    @Query("""
            SELECT AVG(feedback.rating)
            FROM MentoringRelationshipFeedback feedback
            WHERE feedback.relationship.mentorUser.id = :mentorUserId
            """)
    Double averageRatingByMentorUserId(Long mentorUserId);
}
