package com.boa.apid.coaching.importpms.repository;

import com.boa.apid.coaching.importpms.entity.PmsBatchStatus;
import com.boa.apid.coaching.importpms.entity.PmsReportBatch;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;

public interface PmsReportBatchRepository extends JpaRepository<PmsReportBatch, Long> {

    @Query("SELECT b FROM PmsReportBatch b WHERE b.fileSha256 = :sha256 AND b.status = 'COMMITTED'")
    Optional<PmsReportBatch> findCommittedBySha256(@Param("sha256") String sha256);

    boolean existsByPerformanceFiscalQuarterIdAndStatus(Long performanceFiscalQuarterId, PmsBatchStatus status);

    Page<PmsReportBatch> findAllByOrderByCreatedAtDesc(Pageable pageable);

    boolean existsByPerformanceFiscalQuarterId(Long performanceFiscalQuarterId);
    boolean existsByCoachingFiscalQuarterId(Long coachingFiscalQuarterId);
}

