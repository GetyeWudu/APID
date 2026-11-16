package com.boa.apid.mentoring.collaboration.dto;

import com.boa.apid.mentoring.collaboration.entity.MentoringProgressNote;

import java.time.Instant;

public record MentoringProgressNoteDto(
        Long id,
        Long relationshipId,
        Long authorUserId,
        String authorName,
        String note,
        Instant createdAt
) {
    public static MentoringProgressNoteDto from(MentoringProgressNote progressNote) {
        return new MentoringProgressNoteDto(
                progressNote.getId(),
                progressNote.getRelationship().getId(),
                progressNote.getAuthor().getId(),
                progressNote.getAuthor().getUsername(),
                progressNote.getNote(),
                progressNote.getCreatedAt()
        );
    }
}
