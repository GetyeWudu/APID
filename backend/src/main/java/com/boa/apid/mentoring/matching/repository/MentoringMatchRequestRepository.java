package com.boa.apid.mentoring.matching.repository;

import com.boa.apid.mentoring.matching.entity.MentoringMatchRequest;
import com.boa.apid.mentoring.matching.entity.MentoringMatchRequestStatus;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface MentoringMatchRequestRepository extends JpaRepository<MentoringMatchRequest, Long> {

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT request FROM MentoringMatchRequest request WHERE request.id = :id")
    Optional<MentoringMatchRequest> findByIdForUpdate(@Param("id") Long id);

    @EntityGraph(attributePaths = {"traineeEmployee", "skill", "matchedTrainer", "matchedBy"})
    List<MentoringMatchRequest> findAllByOrderByCreatedAtDesc();

    List<MentoringMatchRequest> findByStatusOrderByCreatedAtAsc(MentoringMatchRequestStatus status);

    @EntityGraph(attributePaths = {"traineeEmployee", "skill", "matchedTrainer", "matchedBy"})
    List<MentoringMatchRequest> findByTraineeEmployee_UserIdOrderByCreatedAtDesc(Long userId);

    boolean existsByTraineeEmployee_UserIdAndSkill_IdAndStatus(
            Long userId,
            Long skillId,
            MentoringMatchRequestStatus status
    );

    long countBySkill_IdAndStatus(Long skillId, MentoringMatchRequestStatus status);
}
