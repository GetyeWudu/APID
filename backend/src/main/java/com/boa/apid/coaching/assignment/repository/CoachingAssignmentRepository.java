package com.boa.apid.coaching.assignment.repository;

import com.boa.apid.coaching.assignment.entity.AssignmentStatus;
import com.boa.apid.coaching.assignment.entity.CoachingAssignment;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface CoachingAssignmentRepository extends JpaRepository<CoachingAssignment, Long>, JpaSpecificationExecutor<CoachingAssignment> {

    @Query("""
            SELECT a FROM CoachingAssignment a
            WHERE a.coacheeEmployeeId = :employeeId
            AND a.pathway = 'MANDATORY_PMS'
            AND a.status IN ('ACTIVE', 'PENDING_COACH_ASSIGNMENT')
            """)
    List<CoachingAssignment> findOpenMandatoryByCoacheeEmployeeId(@Param("employeeId") Long employeeId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT a FROM CoachingAssignment a WHERE a.id = :id")
    Optional<CoachingAssignment> findByIdForUpdate(@Param("id") Long id);

    List<CoachingAssignment> findAllByCoacheeEmployeeIdAndStatusInOrderByCreatedAtDesc(
            Long coacheeEmployeeId, Collection<AssignmentStatus> statuses);

    List<CoachingAssignment> findAllByCoachEmployeeIdAndStatusInOrderByCreatedAtDesc(
            Long coachEmployeeId, Collection<AssignmentStatus> statuses);

    boolean existsByCoachEmployeeIdAndCoacheeEmployeeId(Long coachEmployeeId, Long coacheeEmployeeId);

    boolean existsByPerformanceFiscalQuarterId(Long performanceFiscalQuarterId);
    boolean existsByCoachingFiscalQuarterId(Long coachingFiscalQuarterId);
}

