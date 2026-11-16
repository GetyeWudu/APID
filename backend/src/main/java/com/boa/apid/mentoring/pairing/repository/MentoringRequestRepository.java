package com.boa.apid.mentoring.pairing.repository;

import com.boa.apid.mentoring.pairing.entity.MentoringRequest;
import org.springframework.data.jpa.repository.JpaRepository;

public interface MentoringRequestRepository extends JpaRepository<MentoringRequest, Long> {
}
