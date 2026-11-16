package com.boa.apid.mentoring.collaboration.repository;

import com.boa.apid.mentoring.collaboration.entity.MentoringProgressNote;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface MentoringProgressNoteRepository extends JpaRepository<MentoringProgressNote, Long> {

    @EntityGraph(attributePaths = {"author"})
    List<MentoringProgressNote> findByRelationship_IdOrderByCreatedAtDesc(Long relationshipId);
}
