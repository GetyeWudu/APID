package com.boa.apid.coaching.session.repository;

import com.boa.apid.coaching.session.entity.ProposalStatus;
import com.boa.apid.coaching.session.entity.SessionScheduleProposal;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface SessionScheduleProposalRepository extends JpaRepository<SessionScheduleProposal, Long> {

    List<SessionScheduleProposal> findAllBySessionIdOrderByCreatedAtDesc(Long sessionId);

    Optional<SessionScheduleProposal> findFirstBySessionIdAndStatusOrderByCreatedAtDesc(
            Long sessionId, ProposalStatus status);
}

