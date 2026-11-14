package com.boa.apid.coaching.session.repository;

import com.boa.apid.coaching.session.entity.CoachingSession;
import com.boa.apid.coaching.session.entity.SessionStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.Collection;
import java.util.List;

public interface CoachingSessionRepository extends JpaRepository<CoachingSession, Long> {

    List<CoachingSession> findAllByAssignmentIdOrderByScheduledStartTimeDesc(Long assignmentId);

    List<CoachingSession> findAllByAssignmentId(Long assignmentId);

    List<CoachingSession> findAllBySkillRequestIdOrderByScheduledStartTimeDesc(Long skillRequestId);

    List<CoachingSession> findAllBySkillRequestId(Long skillRequestId);

    List<CoachingSession> findAllBySeriesIdOrderBySequenceNumberAsc(Long seriesId);

    List<CoachingSession> findAllByCoachEmployeeIdOrderByScheduledStartTimeDesc(Long coachEmployeeId);

    @Query("""
            SELECT s FROM CoachingSession s
            JOIN SessionParticipant p ON p.sessionId = s.id
            WHERE p.employeeId = :employeeId
            ORDER BY s.scheduledStartTime DESC
            """)
    List<CoachingSession> findAllByParticipantEmployeeId(@Param("employeeId") Long employeeId);

    @Query("""
            SELECT s FROM CoachingSession s
            JOIN SessionParticipant p ON p.sessionId = s.id
            WHERE p.employeeId = :employeeId
            AND s.scheduledStartTime >= :after
            AND s.status NOT IN ('CANCELLED', 'EXPIRED')
            ORDER BY s.scheduledStartTime ASC
            """)
    List<CoachingSession> findUpcomingByParticipantEmployeeId(
            @Param("employeeId") Long employeeId,
            @Param("after") Instant after
    );

    @Query("""
            SELECT COUNT(s) > 0 FROM CoachingSession s
            WHERE s.coachEmployeeId = :coachId
            AND s.id <> :excludeSessionId
            AND s.status NOT IN ('CANCELLED', 'EXPIRED')
            AND s.scheduledStartTime < :endTime
            AND s.scheduledEndTime > :startTime
            """)
    boolean hasOverlappingCoachSession(
            @Param("coachId") Long coachId,
            @Param("startTime") Instant startTime,
            @Param("endTime") Instant endTime,
            @Param("excludeSessionId") Long excludeSessionId
    );
}

