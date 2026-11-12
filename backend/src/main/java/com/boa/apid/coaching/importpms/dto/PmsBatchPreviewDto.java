package com.boa.apid.coaching.importpms.dto;

import org.springframework.data.domain.Page;

public record PmsBatchPreviewDto(
        PmsBatchSummaryDto batch,
        Page<PmsConsolidatedEmployeeDto> employees
) {}

