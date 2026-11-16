package com.boa.apid.coaching.governance.repository;

import com.boa.apid.coaching.governance.entity.CoachingSessionTarget;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface CoachingSessionTargetRepository extends JpaRepository<CoachingSessionTarget, Long> {

    Optional<CoachingSessionTarget> findByAssignmentId(Long assignmentId);

    Optional<CoachingSessionTarget> findBySkillRequestId(Long skillRequestId);
}

