package com.boa.apid.mentoring.trainer.repository;

import com.boa.apid.mentoring.trainer.entity.MentorBadgeRemovalRequest;
import com.boa.apid.mentoring.trainer.entity.MentorBadgeRemovalRequestStatus;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface MentorBadgeRemovalRequestRepository extends JpaRepository<MentorBadgeRemovalRequest, Long> {

    @EntityGraph(attributePaths = {"authorization", "authorization.employee"})
    Optional<MentorBadgeRemovalRequest> findFirstByAuthorization_Employee_UserIdOrderByCreatedAtDesc(Long userId);

    @EntityGraph(attributePaths = {"authorization", "authorization.employee"})
    Optional<MentorBadgeRemovalRequest> findFirstByAuthorization_IdOrderByCreatedAtDesc(Long authorizationId);

    boolean existsByAuthorization_IdAndStatus(
            Long authorizationId,
            MentorBadgeRemovalRequestStatus status
    );

    @EntityGraph(attributePaths = {"authorization", "authorization.employee"})
    List<MentorBadgeRemovalRequest> findByStatusOrderByCreatedAtAsc(MentorBadgeRemovalRequestStatus status);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT request FROM MentorBadgeRemovalRequest request WHERE request.id = :id")
    Optional<MentorBadgeRemovalRequest> findByIdForUpdate(@Param("id") Long id);
}
