package com.boa.apid.mentoring.application.repository;

import com.boa.apid.mentoring.application.entity.MentorApplication;
import com.boa.apid.mentoring.application.entity.MentorApplicationReviewScope;
import com.boa.apid.mentoring.application.entity.MentorApplicationStatus;
import com.boa.apid.mentoring.application.entity.MentorApplicationType;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface MentorApplicationRepository extends JpaRepository<MentorApplication, Long> {

    List<MentorApplication> findAllByApplicant_IdOrderBySubmittedAtDesc(Long applicantId);

    List<MentorApplication> findAllByApplicant_IdAndApplicationTypeAndStatus(
            Long applicantId,
            MentorApplicationType applicationType,
            MentorApplicationStatus status
    );

    boolean existsByApplicant_IdAndApplicationTypeAndStatusIn(
            Long applicantId,
            MentorApplicationType applicationType,
            List<MentorApplicationStatus> statuses
    );

    List<MentorApplication> findAllByOrderBySubmittedAtDesc();

    List<MentorApplication> findAllByReviewScopeOrderBySubmittedAtDesc(MentorApplicationReviewScope reviewScope);

    long countByStatus(MentorApplicationStatus status);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT application FROM MentorApplication application WHERE application.id = :id")
    Optional<MentorApplication> findByIdForUpdate(@Param("id") Long id);
}
