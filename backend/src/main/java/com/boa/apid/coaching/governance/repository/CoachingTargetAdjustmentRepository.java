package com.boa.apid.coaching.governance.repository;

import com.boa.apid.coaching.governance.entity.CoachingTargetAdjustment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface CoachingTargetAdjustmentRepository extends JpaRepository<CoachingTargetAdjustment, Long> {

    List<CoachingTargetAdjustment> findAllBySessionTargetIdOrderByCreatedAtDesc(Long sessionTargetId);
}

