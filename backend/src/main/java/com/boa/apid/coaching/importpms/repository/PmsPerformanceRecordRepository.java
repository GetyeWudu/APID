package com.boa.apid.coaching.importpms.repository;

import com.boa.apid.coaching.importpms.entity.PmsPerformanceRecord;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface PmsPerformanceRecordRepository extends JpaRepository<PmsPerformanceRecord, Long> {

    Optional<PmsPerformanceRecord> findByEmployeeIdAndPerformanceFiscalQuarterId(
            Long employeeId, Long performanceFiscalQuarterId);

    boolean existsByBatchId(Long batchId);
}

