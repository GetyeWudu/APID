package com.boa.apid.coaching.assignment.dto;

import java.util.List;

public record MyCoachingWorkspaceDto(
        List<MyCoachingPlanDto> activePlans
) {}

