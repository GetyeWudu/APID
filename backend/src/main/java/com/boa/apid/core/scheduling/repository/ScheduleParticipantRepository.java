package com.boa.apid.core.scheduling.repository;

import com.boa.apid.core.scheduling.entity.ScheduleParticipant;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.Collection;
import java.util.List;

@Repository
public interface ScheduleParticipantRepository extends JpaRepository<ScheduleParticipant, Long> {

    @Query("SELECT p FROM ScheduleParticipant p " +
           "JOIN FETCH p.scheduleEvent e " +
           "JOIN FETCH p.employee emp " +
           "WHERE p.employeeId IN :employeeIds " +
           "  AND p.reservationStatus = 'ACTIVE' " +
           "  AND e.status != 'CANCELLED' " +
           "  AND e.startAt < :endAt AND e.endAt > :startAt " +
           "  AND (:excludeEventId IS NULL OR e.id != :excludeEventId)")
    List<ScheduleParticipant> findConflictingReservations(
            @Param("employeeIds") Collection<Long> employeeIds,
            @Param("startAt") Instant startAt,
            @Param("endAt") Instant endAt,
            @Param("excludeEventId") Long excludeEventId
    );

    @Query("SELECT p FROM ScheduleParticipant p " +
           "JOIN FETCH p.scheduleEvent e " +
           "WHERE p.employeeId = :employeeId " +
           "  AND p.reservationStatus = 'ACTIVE' " +
           "  AND e.status != 'CANCELLED' " +
           "  AND e.startAt >= :fromInstant AND e.startAt < :toInstant " +
           "ORDER BY e.startAt ASC")
    List<ScheduleParticipant> findMyActiveCalendarEvents(
            @Param("employeeId") Long employeeId,
            @Param("fromInstant") Instant fromInstant,
            @Param("toInstant") Instant toInstant
    );

    List<ScheduleParticipant> findAllByScheduleEventId(Long scheduleEventId);
}

