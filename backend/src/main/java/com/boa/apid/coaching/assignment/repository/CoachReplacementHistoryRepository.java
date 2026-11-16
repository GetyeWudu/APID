package com.boa.apid.coaching.assignment.repository;

import com.boa.apid.coaching.assignment.entity.CoachReplacementHistory;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface CoachReplacementHistoryRepository extends JpaRepository<CoachReplacementHistory, Long> {

    List<CoachReplacementHistory> findAllByAssignmentIdOrderByChangedAtAsc(Long assignmentId);
}

