package com.boa.apid.coaching.session.repository;

import com.boa.apid.coaching.session.entity.CoachingSessionTurn;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface CoachingSessionTurnRepository extends JpaRepository<CoachingSessionTurn, Long> {

    List<CoachingSessionTurn> findAllBySessionIdOrderByTurnIndexAsc(Long sessionId);

    void deleteAllBySessionId(Long sessionId);
}
