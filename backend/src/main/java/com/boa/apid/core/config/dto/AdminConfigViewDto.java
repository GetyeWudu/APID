package com.boa.apid.core.config.dto;

import java.util.List;

public record AdminConfigViewDto(
        List<SystemConfigItemDto> configs,
        List<FiscalQuarterDto> quarters
) {}

