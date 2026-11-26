package com.boa.apid.mentoring.trainer.repository;

import com.boa.apid.mentoring.trainer.entity.TrainerAuthorization;
import com.boa.apid.mentoring.trainer.entity.TrainerAuthorizationStatus;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import jakarta.persistence.LockModeType;
import java.util.List;
import java.util.Optional;

public interface TrainerAuthorizationRepository extends JpaRepository<TrainerAuthorization, Long> {

    @EntityGraph(attributePaths = {"employee", "skills", "profilePicture"})
    List<TrainerAuthorization> findAllByOrderByUpdatedAtDescIdDesc();

    @EntityGraph(attributePaths = {"employee", "skills"})
    Optional<TrainerAuthorization> findDetailedById(Long id);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT authorization FROM TrainerAuthorization authorization WHERE authorization.id = :id")
    Optional<TrainerAuthorization> findByIdForUpdate(@Param("id") Long id);

    @Query("""
            SELECT authorization
            FROM TrainerAuthorization authorization
            WHERE authorization.employee.id = :employeeId
              AND authorization.status IN :statuses
            ORDER BY authorization.updatedAt DESC, authorization.id DESC
            """)
    List<TrainerAuthorization> findByEmployeeAndStatuses(
            @Param("employeeId") Long employeeId,
            @Param("statuses") List<TrainerAuthorizationStatus> statuses
    );

    @Query("""
            SELECT authorization
            FROM TrainerAuthorization authorization
            JOIN FETCH authorization.employee employee
            WHERE employee.userId = :userId
              AND authorization.status = :status
            ORDER BY authorization.updatedAt DESC, authorization.id DESC
            """)
    List<TrainerAuthorization> findByUserIdAndStatus(
            @Param("userId") Long userId,
            @Param("status") TrainerAuthorizationStatus status
    );

    @Query("""
            SELECT authorization
            FROM TrainerAuthorization authorization
            JOIN FETCH authorization.employee employee
            WHERE employee.userId = :userId
              AND authorization.status = com.boa.apid.mentoring.trainer.entity.TrainerAuthorizationStatus.ACTIVE
            ORDER BY authorization.updatedAt DESC, authorization.id DESC
            """)
    List<TrainerAuthorization> findActiveByUserId(@Param("userId") Long userId);

    @Query("""
            SELECT CASE WHEN COUNT(authorization) > 0 THEN true ELSE false END
            FROM TrainerAuthorization authorization
            WHERE authorization.employee.id = :employeeId
              AND authorization.status IN :statuses
            """)
    boolean existsByEmployeeAndStatuses(
            @Param("employeeId") Long employeeId,
            @Param("statuses") List<TrainerAuthorizationStatus> statuses
    );
}
