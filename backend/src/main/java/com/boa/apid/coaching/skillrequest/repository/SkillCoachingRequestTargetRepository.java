package com.boa.apid.coaching.skillrequest.repository;

import com.boa.apid.coaching.skillrequest.entity.SkillCoachingRequestTarget;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface SkillCoachingRequestTargetRepository extends JpaRepository<SkillCoachingRequestTarget, Long> {

    List<SkillCoachingRequestTarget> findAllByRequestId(Long requestId);
}

