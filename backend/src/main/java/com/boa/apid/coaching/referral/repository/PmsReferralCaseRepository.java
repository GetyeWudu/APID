package com.boa.apid.coaching.referral.repository;

import com.boa.apid.coaching.referral.entity.PmsReferralCase;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface PmsReferralCaseRepository extends JpaRepository<PmsReferralCase, Long> {

    List<PmsReferralCase> findAllByOrderByEscalatedAtDesc();

    List<PmsReferralCase> findAllByStatusOrderByEscalatedAtDesc(String status);

    Optional<PmsReferralCase> findByCoacheeEmployeeIdAndStatus(Long coacheeEmployeeId, String status);

    boolean existsByCoacheeEmployeeIdAndStatus(Long coacheeEmployeeId, String status);

    List<PmsReferralCase> findAllByCurrentCoachEmployeeIdOrderByEscalatedAtDesc(Long currentCoachEmployeeId);
}
