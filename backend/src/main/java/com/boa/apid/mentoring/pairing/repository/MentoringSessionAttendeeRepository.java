package com.boa.apid.mentoring.pairing.repository;

import com.boa.apid.mentoring.pairing.entity.MentoringSessionAttendee;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface MentoringSessionAttendeeRepository extends JpaRepository<MentoringSessionAttendee, Long> {

    @EntityGraph(attributePaths = {"member", "member.traineeUser"})
    List<MentoringSessionAttendee> findBySession_Id(Long sessionId);

    @EntityGraph(attributePaths = {"member", "member.traineeUser"})
    @Query("""
            SELECT attendee FROM MentoringSessionAttendee attendee
            WHERE attendee.session.id IN :sessionIds
            """)
    List<MentoringSessionAttendee> findBySessionIdIn(@Param("sessionIds") List<Long> sessionIds);

    Optional<MentoringSessionAttendee> findBySession_IdAndMember_TraineeUser_Id(
            Long sessionId,
            Long traineeUserId
    );

    boolean existsBySession_IdAndMember_TraineeUser_Id(Long sessionId, Long traineeUserId);
}
