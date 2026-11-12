package com.boa.apid.coaching.assignment.service;

import com.boa.apid.coaching.assignment.repository.CoachingAssignmentRepository;
import com.boa.apid.coaching.importpms.repository.PmsReportBatchRepository;
import com.boa.apid.core.config.service.QuarterUsageChecker;
import org.springframework.stereotype.Component;

/**
 * Prevents Core from deleting or mutating fiscal quarters that are
 * referenced by committed PMS batches or coaching assignments.
 */
@Component
public class CoachingQuarterUsageChecker implements QuarterUsageChecker {

    private final PmsReportBatchRepository batchRepository;
    private final CoachingAssignmentRepository assignmentRepository;

    public CoachingQuarterUsageChecker(
            PmsReportBatchRepository batchRepository,
            CoachingAssignmentRepository assignmentRepository
    ) {
        this.batchRepository = batchRepository;
        this.assignmentRepository = assignmentRepository;
    }

    @Override
    public boolean isQuarterReferenced(Long fiscalQuarterId) {
        if (fiscalQuarterId == null) return false;
        return batchRepository.existsByPerformanceFiscalQuarterId(fiscalQuarterId)
                || batchRepository.existsByCoachingFiscalQuarterId(fiscalQuarterId)
                || assignmentRepository.existsByPerformanceFiscalQuarterId(fiscalQuarterId)
                || assignmentRepository.existsByCoachingFiscalQuarterId(fiscalQuarterId);
    }
}

