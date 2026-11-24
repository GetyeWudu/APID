package com.boa.apid.coaching.report.dto;

import java.util.List;
import java.util.Map;

public record ReportingFilterOptionsDto(
        List<String> districts,
        Map<String, List<String>> branchesByDistrict,
        List<String> performanceBands,
        List<String> coachingLifecycles,
        List<String> sessionProgressStatuses
) {}
