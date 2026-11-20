package com.boa.apid.mentoring.pairing.dto;

import com.boa.apid.mentoring.pairing.entity.MentoringSessionRating;

import java.time.Instant;

public record MentoringSessionRatingDto(
        int rating,
        Instant ratedAt
) {
    public static MentoringSessionRatingDto from(MentoringSessionRating rating) {
        return new MentoringSessionRatingDto(rating.getRating(), rating.getRatedAt());
    }
}
