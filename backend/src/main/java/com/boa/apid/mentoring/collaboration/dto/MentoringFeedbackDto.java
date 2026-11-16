package com.boa.apid.mentoring.collaboration.dto;

import com.boa.apid.mentoring.collaboration.entity.MentoringRelationshipFeedback;

import java.time.Instant;

public record MentoringFeedbackDto(int rating, String feedback, Instant ratedAt) {
    public static MentoringFeedbackDto from(MentoringRelationshipFeedback feedback) {
        return new MentoringFeedbackDto(feedback.getRating(), feedback.getFeedback(), feedback.getRatedAt());
    }
}
