package com.boa.apid.coaching.ai.dto;

public record AiCopilotActionLinkDto(
        String type, // "OPEN_DOSSIER" | "FILTER_BRANCH" | "FILTER_DISTRICT" | "INSPECT_SESSION"
        String label,
        String district,
        String branch,
        Long assignmentId,
        Long sessionId
) {
    public static AiCopilotActionLinkDto dossier(String label, Long assignmentId) {
        return new AiCopilotActionLinkDto("OPEN_DOSSIER", label, null, null, assignmentId, null);
    }

    public static AiCopilotActionLinkDto branchFilter(String label, String district, String branch) {
        return new AiCopilotActionLinkDto("FILTER_BRANCH", label, district, branch, null, null);
    }

    public static AiCopilotActionLinkDto districtFilter(String label, String district) {
        return new AiCopilotActionLinkDto("FILTER_DISTRICT", label, district, null, null, null);
    }

    public static AiCopilotActionLinkDto inspectSession(String label, Long sessionId) {
        return new AiCopilotActionLinkDto("INSPECT_SESSION", label, null, null, null, sessionId);
    }
}
