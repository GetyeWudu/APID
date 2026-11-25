package com.boa.apid.mentoring.collaboration.dto;

import java.time.Instant;

public record MentoringFeedbackRatingEntry(int rating, Instant ratedAt) {
}
