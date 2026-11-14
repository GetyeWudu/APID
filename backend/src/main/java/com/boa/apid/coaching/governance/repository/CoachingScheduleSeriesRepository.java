package com.boa.apid.coaching.governance.repository;

import com.boa.apid.coaching.governance.entity.CoachingScheduleSeries;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface CoachingScheduleSeriesRepository extends JpaRepository<CoachingScheduleSeries, Long> {

    List<CoachingScheduleSeries> findAllByAssignmentId(Long assignmentId);

    List<CoachingScheduleSeries> findAllBySkillRequestId(Long skillRequestId);

    List<CoachingScheduleSeries> findAllByCoachEmployeeIdOrderByCreatedAtDesc(Long coachEmployeeId);

    Optional<CoachingScheduleSeries> findFirstByAssignmentIdAndStatus(Long assignmentId, com.boa.apid.coaching.governance.entity.SeriesStatus status);
}

