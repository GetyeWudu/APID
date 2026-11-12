package com.boa.apid.coaching.importpms.repository;

import com.boa.apid.coaching.importpms.entity.PmsImportEmployeeStaging;
import com.boa.apid.coaching.importpms.entity.PmsImportValidationStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface PmsImportEmployeeStagingRepository extends JpaRepository<PmsImportEmployeeStaging, Long> {

    Page<PmsImportEmployeeStaging> findByBatchId(Long batchId, Pageable pageable);

    Page<PmsImportEmployeeStaging> findByBatchIdAndValidationStatus(
            Long batchId, PmsImportValidationStatus validationStatus, Pageable pageable);

    @Query("""
            SELECT s FROM PmsImportEmployeeStaging s
            WHERE s.batchId = :batchId
            AND s.roundedOverallFinalRating < :cutoff
            """)
    Page<PmsImportEmployeeStaging> findMandatoryByBatchId(
            @Param("batchId") Long batchId,
            @Param("cutoff") short cutoff,
            Pageable pageable);

    @Query("""
            SELECT s FROM PmsImportEmployeeStaging s
            WHERE s.batchId = :batchId
            AND s.roundedOverallFinalRating >= :cutoff
            """)
    Page<PmsImportEmployeeStaging> findPassingByBatchId(
            @Param("batchId") Long batchId,
            @Param("cutoff") short cutoff,
            Pageable pageable);

    List<PmsImportEmployeeStaging> findAllByBatchId(Long batchId);

    @Modifying
    @Query("DELETE FROM PmsImportEmployeeStaging s WHERE s.batchId = :batchId")
    void deleteByBatchId(@Param("batchId") Long batchId);
}

