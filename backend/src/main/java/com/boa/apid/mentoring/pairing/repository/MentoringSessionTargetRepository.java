package com.boa.apid.mentoring.pairing.repository;

import com.boa.apid.mentoring.pairing.entity.MentoringSessionTarget;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface MentoringSessionTargetRepository extends JpaRepository<MentoringSessionTarget, Long> {

    @Query("SELECT t FROM MentoringSessionTarget t JOIN FETCH t.member m JOIN FETCH m.traineeUser WHERE t.session.id = :sessionId")
    List<MentoringSessionTarget> findBySessionId(@Param("sessionId") Long sessionId);

    void deleteBySession_Id(Long sessionId);

    boolean existsBySession_IdAndMember_TraineeUser_Id(Long sessionId, Long traineeUserId);

    @Query("""
            SELECT t FROM MentoringSessionTarget t
            JOIN FETCH t.member m
            JOIN FETCH m.traineeUser
            WHERE t.session.id IN :sessionIds
            """)
    List<MentoringSessionTarget> findBySessionIdIn(@Param("sessionIds") List<Long> sessionIds);
}
