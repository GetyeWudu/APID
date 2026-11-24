package com.boa.apid.coaching.export.controller;

import com.boa.apid.coaching.export.service.ApachePoiExcelExporter;
import com.boa.apid.coaching.export.service.OpenPdfDossierExporter;
import com.boa.apid.coaching.report.dto.DistrictBranchAnalyticsDto;
import com.boa.apid.coaching.report.dto.PmsTalentDossierDto;
import com.boa.apid.coaching.report.dto.PmsTalentProgressItemDto;
import com.boa.apid.coaching.report.service.PmsCoachingReportService;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/coaching/pms/export")
@PreAuthorize("hasAnyAuthority('ROLE_ADMIN', 'PMS_REPORT_UPLOAD', 'COACHING_REQUEST_APPROVE', 'COACHING_INITIATIVE_CREATE', 'COACHING_COACH_REPLACE')")
public class PmsCoachingExportController {

    private final PmsCoachingReportService reportService;
    private final OpenPdfDossierExporter pdfExporter;
    private final ApachePoiExcelExporter excelExporter;

    public PmsCoachingExportController(
            PmsCoachingReportService reportService,
            OpenPdfDossierExporter pdfExporter,
            ApachePoiExcelExporter excelExporter
    ) {
        this.reportService = reportService;
        this.pdfExporter = pdfExporter;
        this.excelExporter = excelExporter;
    }

    @GetMapping("/dossier/pdf")
    public ResponseEntity<byte[]> exportDossierPdf(@RequestParam("assignmentId") Long assignmentId) {
        PmsTalentDossierDto dossier = reportService.getTalentDossier(assignmentId);
        byte[] pdfBytes = pdfExporter.exportDossierPdf(dossier);

        String filename = "BoA_Dossier_" + dossier.coacheeStaffId() + ".pdf";

        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + filename + "\"")
                .contentType(MediaType.APPLICATION_PDF)
                .body(pdfBytes);
    }

    @GetMapping("/district/excel")
    public ResponseEntity<byte[]> exportDistrictScorecardExcel(
            @RequestParam(name = "quarterId", required = false) Long quarterId,
            @RequestParam(name = "district", required = false) String district
    ) {
        Long qId = quarterId != null ? quarterId : 2L;
        DistrictBranchAnalyticsDto analytics = reportService.getHierarchicalAnalytics(qId);
        List<PmsTalentProgressItemDto> talents = reportService.getTalentsProgress(qId, null, null, null, null);

        byte[] excelBytes = excelExporter.exportDistrictScorecardExcel(analytics, talents, district);

        String distClean = (district != null && !district.isBlank()) ? district.replace(" ", "_") : "BankWide";
        String filename = "BoA_Coaching_Scorecard_" + distClean + ".xlsx";

        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + filename + "\"")
                .contentType(MediaType.parseMediaType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"))
                .body(excelBytes);
    }
}
