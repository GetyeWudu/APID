package com.boa.apid.coaching.session.repository;

import com.boa.apid.coaching.session.entity.SessionParticipant;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

public interface SessionParticipantRepository extends JpaRepository<SessionParticipant, Long> {

    List<SessionParticipant> findAllBySessionIdOrderByRoleAsc(Long sessionId);

    Optional<SessionParticipant> findBySessionIdAndEmployeeId(Long sessionId, Long employeeId);

    boolean existsBySessionIdAndEmployeeId(Long sessionId, Long employeeId);

    @Query("""
            SELECT COUNT(p) > 0 FROM SessionParticipant p
            JOIN CoachingSession s ON s.id = p.sessionId
            WHERE p.employeeId = :employeeId
            AND s.id <> :excludeSessionId
            AND s.status NOT IN ('CANCELLED', 'EXPIRED')
            AND s.scheduledStartTime < :endTime
            AND s.scheduledEndTime > :startTime
            """)
    boolean hasOverlappingParticipantSession(
            @Param("employeeId") Long employeeId,
            @Param("startTime") Instant startTime,
            @Param("endTime") Instant endTime,
            @Param("excludeSessionId") Long excludeSessionId
    );
}

