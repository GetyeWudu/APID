package com.boa.apid.coaching.assignment.repository;

import com.boa.apid.coaching.assignment.entity.AssignmentStatus;
import com.boa.apid.coaching.assignment.entity.CoachingAssignment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface CoachingAssignmentRepository extends JpaRepository<CoachingAssignment, Long> {

    @Query("""
            SELECT a FROM CoachingAssignment a
            WHERE a.coacheeEmployeeId = :employeeId
            AND a.pathway = 'MANDATORY_PMS'
            AND a.status IN ('ACTIVE', 'PENDING_COACH_ASSIGNMENT')
            """)
    List<CoachingAssignment> findOpenMandatoryByCoacheeEmployeeId(@Param("employeeId") Long employeeId);

    boolean existsByPerformanceFiscalQuarterId(Long performanceFiscalQuarterId);
    boolean existsByCoachingFiscalQuarterId(Long coachingFiscalQuarterId);
}

