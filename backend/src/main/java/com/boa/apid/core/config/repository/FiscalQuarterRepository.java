package com.boa.apid.core.config.repository;

import com.boa.apid.core.config.entity.FiscalQuarter;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface FiscalQuarterRepository extends JpaRepository<FiscalQuarter, Long> {

    Optional<FiscalQuarter> findByActiveTrue();

    Optional<FiscalQuarter> findByFiscalYearIgnoreCaseAndQuarter(String fiscalYear, Short quarter);

    List<FiscalQuarter> findAllByOrderByStartDateDesc();

    boolean existsByFiscalYearIgnoreCaseAndQuarter(String fiscalYear, Short quarter);

    boolean existsByFiscalYearIgnoreCaseAndQuarterAndIdNot(String fiscalYear, Short quarter, Long id);

    @Query("""
            SELECT q FROM FiscalQuarter q
            WHERE (:excludeId IS NULL OR q.id <> :excludeId)
              AND q.startDate <= :endDate
              AND q.endDate >= :startDate
            """)
    List<FiscalQuarter> findOverlapping(
            @Param("startDate") LocalDate startDate,
            @Param("endDate") LocalDate endDate,
            @Param("excludeId") Long excludeId
    );

    @Query("""
            SELECT q FROM FiscalQuarter q
            WHERE :targetDate BETWEEN q.startDate AND q.endDate
            ORDER BY q.startDate DESC
            """)
    List<FiscalQuarter> findContainingDate(@Param("targetDate") LocalDate targetDate);
}

