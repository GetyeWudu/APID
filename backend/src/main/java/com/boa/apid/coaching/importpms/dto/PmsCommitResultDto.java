package com.boa.apid.coaching.importpms.dto;

public record PmsCommitResultDto(
        Long batchId,
        int performanceRecordsCreated,
        int assignmentsCreated,
        int assignmentsContinued,
        int assignmentsCleared,
        int pendingCoachAssignments,
        String message
) {}

