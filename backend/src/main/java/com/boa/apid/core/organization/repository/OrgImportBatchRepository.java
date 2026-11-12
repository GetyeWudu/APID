package com.boa.apid.core.organization.repository;

import com.boa.apid.core.organization.entity.OrgImportBatch;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;

public interface OrgImportBatchRepository extends JpaRepository<OrgImportBatch, Long> {

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT b FROM OrgImportBatch b WHERE b.id = :id")
    Optional<OrgImportBatch> findByIdForUpdate(@Param("id") Long id);
}

