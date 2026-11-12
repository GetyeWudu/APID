package com.boa.apid.core.config.dto;

public record ActiveConfigResponseDto(
        ActiveCycleDto activeQuarter,
        String calendarQuarterLabel,
        PublicConfigDto publicConfig
) {}

