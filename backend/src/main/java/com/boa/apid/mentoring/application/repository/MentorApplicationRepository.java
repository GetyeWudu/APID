package com.boa.apid.mentoring.application.repository;

import com.boa.apid.mentoring.application.entity.MentorApplication;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface MentorApplicationRepository extends JpaRepository<MentorApplication, Long> {

    List<MentorApplication> findAllByApplicant_IdOrderBySubmittedAtDesc(Long applicantId);

}
