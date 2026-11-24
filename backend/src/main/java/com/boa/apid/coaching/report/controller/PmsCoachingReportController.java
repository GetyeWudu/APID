package com.boa.apid.coaching.report.controller;

import com.boa.apid.coaching.report.dto.*;
import com.boa.apid.coaching.report.service.PmsCoachingReportService;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.nio.charset.StandardCharsets;
import java.util.List;

@RestController
@RequestMapping("/api/v1/coaching/reports")
@PreAuthorize("hasAnyAuthority('PMS_REPORT_UPLOAD', 'COACHING_REQUEST_APPROVE', 'COACHING_INITIATIVE_CREATE', 'ROLE_ADMIN')")
public class PmsCoachingReportController {

    private final PmsCoachingReportService reportService;

    public PmsCoachingReportController(PmsCoachingReportService reportService) {
        this.reportService = reportService;
    }

    @GetMapping("/summary")
    public ResponseEntity<PmsReportSummaryDto> getSummary(
            @RequestParam(name = "quarterId", required = false) Long quarterId
    ) {
        return ResponseEntity.ok(reportService.getReportSummary(quarterId));
    }

    @GetMapping("/hierarchical-analytics")
    public ResponseEntity<DistrictBranchAnalyticsDto> getHierarchicalAnalytics(
            @RequestParam(name = "quarterId", required = false) Long quarterId
    ) {
        return ResponseEntity.ok(reportService.getHierarchicalAnalytics(quarterId));
    }

    @GetMapping("/filter-options")
    public ResponseEntity<ReportingFilterOptionsDto> getFilterOptions(
            @RequestParam(name = "quarterId", required = false) Long quarterId
    ) {
        return ResponseEntity.ok(reportService.getFilterOptions(quarterId));
    }

    @GetMapping("/talents")
    public ResponseEntity<List<PmsTalentProgressItemDto>> getTalents(
            @RequestParam(name = "quarterId", required = false) Long quarterId,
            @RequestParam(name = "directorate", required = false) String directorate,
            @RequestParam(name = "district", required = false) String district,
            @RequestParam(name = "branch", required = false) String branch,
            @RequestParam(name = "performanceBand", required = false) String performanceBand,
            @RequestParam(name = "sessionProgress", required = false) String sessionProgress,
            @RequestParam(name = "kpiType", required = false) String kpiType,
            @RequestParam(name = "status", required = false) String status,
            @RequestParam(name = "attentionOnly", required = false) Boolean attentionOnly,
            @RequestParam(name = "search", required = false) String search
    ) {
        String effectiveDistrict = (district != null && !district.isBlank()) ? district : directorate;
        return ResponseEntity.ok(reportService.getTalentsProgress(
                quarterId, effectiveDistrict, status, attentionOnly, search,
                branch, performanceBand, sessionProgress, kpiType));
    }

    @GetMapping("/cohort")
    public ResponseEntity<List<PmsTalentProgressItemDto>> getCohort(
            @RequestParam(name = "quarterId", required = false) Long quarterId,
            @RequestParam(name = "kpiType", required = false) String kpiType,
            @RequestParam(name = "district", required = false) String district,
            @RequestParam(name = "branch", required = false) String branch,
            @RequestParam(name = "performanceBand", required = false) String performanceBand
    ) {
        return ResponseEntity.ok(reportService.getTalentsProgress(
                quarterId, district, null, null, null,
                branch, performanceBand, null, kpiType));
    }

    @GetMapping("/talents/{assignmentId}/dossier")
    public ResponseEntity<PmsTalentDossierDto> getTalentDossier(
            @PathVariable("assignmentId") Long assignmentId
    ) {
        return ResponseEntity.ok(reportService.getTalentDossier(assignmentId));
    }

    @GetMapping("/sessions/{sessionId}/evidence")
    public ResponseEntity<SessionInspectionEvidenceDto> getSessionEvidence(
            @PathVariable("sessionId") Long sessionId
    ) {
        return ResponseEntity.ok(reportService.getSessionInspectionEvidence(sessionId));
    }

    @GetMapping("/export")
    public ResponseEntity<byte[]> exportCsv(
            @RequestParam(name = "quarterId", required = false) Long quarterId,
            @RequestParam(name = "directorate", required = false) String directorate,
            @RequestParam(name = "status", required = false) String status,
            @RequestParam(name = "attentionOnly", required = false) Boolean attentionOnly
    ) {
        String csv = reportService.exportReportCsv(quarterId, directorate, status, attentionOnly);
        byte[] bytes = csv.getBytes(StandardCharsets.UTF_8);

        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"boa-pms-coaching-performance-report.csv\"")
                .contentType(MediaType.parseMediaType("text/csv; charset=UTF-8"))
                .body(bytes);
    }
}

