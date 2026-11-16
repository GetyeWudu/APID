package com.boa.apid.coaching.importpms.repository;

import com.boa.apid.coaching.importpms.entity.PmsGoalLine;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface PmsGoalLineRepository extends JpaRepository<PmsGoalLine, Long> {

    List<PmsGoalLine> findAllByPerformanceRecordIdOrderBySourceRowNumberAsc(Long performanceRecordId);
}

