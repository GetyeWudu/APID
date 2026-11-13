package com.boa.apid.coaching.assignment.repository;

import com.boa.apid.coaching.assignment.entity.CoachingParticipant;
import com.boa.apid.coaching.assignment.entity.ParticipantRole;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface CoachingParticipantRepository extends JpaRepository<CoachingParticipant, Long> {

    List<CoachingParticipant> findAllByAssignmentIdOrderByCreatedAtAsc(Long assignmentId);

    Optional<CoachingParticipant> findByAssignmentIdAndRoleAndActiveTrue(Long assignmentId, ParticipantRole role);

    List<CoachingParticipant> findAllByAssignmentIdAndActiveTrue(Long assignmentId);
}

