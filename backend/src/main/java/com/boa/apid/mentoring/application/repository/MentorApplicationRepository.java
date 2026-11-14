package com.boa.apid.mentoring.application.repository;

import com.boa.apid.mentoring.application.entity.MentorApplication;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface MentorApplicationRepository extends JpaRepository<MentorApplication, Long> {

    List<MentorApplication> findAllByApplicant_IdOrderBySubmittedAtDesc(Long applicantId);

    List<MentorApplication> findAllByOrderBySubmittedAtDesc();

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT application FROM MentorApplication application WHERE application.id = :id")
    Optional<MentorApplication> findByIdForUpdate(@Param("id") Long id);
}
