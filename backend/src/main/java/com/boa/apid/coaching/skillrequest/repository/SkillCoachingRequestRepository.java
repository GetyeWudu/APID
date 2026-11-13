package com.boa.apid.coaching.skillrequest.repository;

import com.boa.apid.coaching.skillrequest.entity.SkillCoachingRequest;
import com.boa.apid.coaching.skillrequest.entity.SkillCoachingRequestStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

import java.util.List;

public interface SkillCoachingRequestRepository extends JpaRepository<SkillCoachingRequest, Long>, JpaSpecificationExecutor<SkillCoachingRequest> {

    List<SkillCoachingRequest> findAllByRequesterEmployeeIdOrderByCreatedAtDesc(Long requesterEmployeeId);

    List<SkillCoachingRequest> findAllByStatusOrderByCreatedAtDesc(SkillCoachingRequestStatus status);

    List<SkillCoachingRequest> findAllByOrderByCreatedAtDesc();
}

