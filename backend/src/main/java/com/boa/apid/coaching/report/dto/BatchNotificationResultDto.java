package com.boa.apid.coaching.report.dto;

public record BatchNotificationResultDto(
        int totalStalledCoaches,
        int notificationsDispatched,
        int emailsQueued,
        String executionStatus
) {}
