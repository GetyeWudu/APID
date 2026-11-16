package com.boa.apid.coaching.report.controller;

import com.boa.apid.coaching.report.dto.PmsReportSummaryDto;
import com.boa.apid.coaching.report.dto.PmsTalentDossierDto;
import com.boa.apid.coaching.report.dto.PmsTalentProgressItemDto;
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

    @GetMapping("/talents")
    public ResponseEntity<List<PmsTalentProgressItemDto>> getTalents(
            @RequestParam(name = "quarterId", required = false) Long quarterId,
            @RequestParam(name = "directorate", required = false) String directorate,
            @RequestParam(name = "status", required = false) String status,
            @RequestParam(name = "attentionOnly", required = false) Boolean attentionOnly,
            @RequestParam(name = "search", required = false) String search
    ) {
        return ResponseEntity.ok(reportService.getTalentsProgress(quarterId, directorate, status, attentionOnly, search));
    }

    @GetMapping("/talents/{assignmentId}/dossier")
    public ResponseEntity<PmsTalentDossierDto> getTalentDossier(
            @PathVariable("assignmentId") Long assignmentId
    ) {
        return ResponseEntity.ok(reportService.getTalentDossier(assignmentId));
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

