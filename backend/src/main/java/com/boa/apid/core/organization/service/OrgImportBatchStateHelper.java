package com.boa.apid.core.organization.service;

import com.boa.apid.core.organization.entity.OrgImportBatchStatus;
import com.boa.apid.core.organization.repository.OrgImportBatchRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/**
 * Persists terminal batch state transitions in an independent transaction
 * when validation or expiration rejects a commit attempt.
 */
@Service
class OrgImportBatchStateHelper {

    private final OrgImportBatchRepository batchRepository;

    OrgImportBatchStateHelper(OrgImportBatchRepository batchRepository) {
        this.batchRepository = batchRepository;
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    void markStatus(Long batchId, OrgImportBatchStatus status) {
        batchRepository.findById(batchId).ifPresent(batch -> {
            batch.setStatus(status);
            batchRepository.save(batch);
        });
    }
}

