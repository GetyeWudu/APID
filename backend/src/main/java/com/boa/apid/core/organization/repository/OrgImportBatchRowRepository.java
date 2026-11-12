package com.boa.apid.core.organization.repository;

import com.boa.apid.core.organization.entity.OrgImportBatchRow;
import com.boa.apid.core.organization.entity.OrgImportRowStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface OrgImportBatchRowRepository extends JpaRepository<OrgImportBatchRow, Long> {

    List<OrgImportBatchRow> findAllByBatchIdOrderByIdAsc(Long batchId);

    Page<OrgImportBatchRow> findByBatchIdOrderByIdAsc(Long batchId, Pageable pageable);

    Page<OrgImportBatchRow> findByBatchIdAndRowStatusOrderByIdAsc(Long batchId, OrgImportRowStatus rowStatus, Pageable pageable);
}

