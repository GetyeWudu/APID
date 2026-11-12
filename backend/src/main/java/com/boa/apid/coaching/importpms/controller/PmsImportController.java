package com.boa.apid.coaching.importpms.controller;

import com.boa.apid.coaching.importpms.dto.*;
import com.boa.apid.coaching.importpms.service.PmsImportService;
import com.boa.apid.common.response.ApiResponse;
import com.boa.apid.core.auth.security.ApidUserPrincipal;
import org.springframework.data.domain.Page;
import org.springframework.http.MediaType;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/v1/coaching/pms-imports")
public class PmsImportController {

    private final PmsImportService pmsImportService;

    public PmsImportController(PmsImportService pmsImportService) {
        this.pmsImportService = pmsImportService;
    }

    /**
     * Upload an XLSX appraisal file and create a PREVIEW batch.
     */
    @PostMapping(value = "/preview", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize("hasAuthority('PMS_REPORT_UPLOAD')")
    public ApiResponse<PmsBatchPreviewDto> preview(
            @RequestParam("file") MultipartFile file,
            @RequestParam("performanceFiscalQuarterId") Long performanceFiscalQuarterId,
            @RequestParam("coachingFiscalQuarterId") Long coachingFiscalQuarterId,
            @RequestParam(value = "page", defaultValue = "0") int page,
            @RequestParam(value = "size", defaultValue = "20") int size,
            @AuthenticationPrincipal ApidUserPrincipal actor
    ) {
        return ApiResponse.ok(pmsImportService.preview(
                file, performanceFiscalQuarterId, coachingFiscalQuarterId, page, size, actor));
    }

    /**
     * Paginate the staged employee preview rows of a PREVIEW batch.
     */
    @GetMapping("/{batchId}/preview")
    @PreAuthorize("hasAuthority('PMS_REPORT_UPLOAD')")
    public ApiResponse<PmsBatchPreviewDto> getPreview(
            @PathVariable Long batchId,
            @RequestParam(value = "filter", defaultValue = "ALL") String filter,
            @RequestParam(value = "page", defaultValue = "0") int page,
            @RequestParam(value = "size", defaultValue = "20") int size,
            @AuthenticationPrincipal ApidUserPrincipal actor
    ) {
        return ApiResponse.ok(pmsImportService.getPreview(batchId, filter, page, size, actor));
    }

    /**
     * Commit a validated PREVIEW batch → creates performance records and coaching assignments.
     */
    @PostMapping("/{batchId}/commit")
    @PreAuthorize("hasAuthority('PMS_REPORT_UPLOAD')")
    public ApiResponse<PmsCommitResultDto> commit(
            @PathVariable Long batchId,
            @AuthenticationPrincipal ApidUserPrincipal actor
    ) {
        return ApiResponse.ok(pmsImportService.commit(batchId, actor));
    }

    /**
     * Cancel an uncommitted PREVIEW or FAILED batch.
     */
    @DeleteMapping("/{batchId}")
    @PreAuthorize("hasAuthority('PMS_REPORT_UPLOAD')")
    public ApiResponse<Void> cancel(
            @PathVariable Long batchId,
            @AuthenticationPrincipal ApidUserPrincipal actor
    ) {
        pmsImportService.cancel(batchId, actor);
        return ApiResponse.ok(null);
    }

    /**
     * List PMS batch history (all statuses, newest first).
     */
    @GetMapping("/history")
    @PreAuthorize("hasAuthority('PMS_REPORT_UPLOAD')")
    public ApiResponse<Page<PmsBatchSummaryDto>> history(
            @RequestParam(value = "page", defaultValue = "0") int page,
            @RequestParam(value = "size", defaultValue = "20") int size
    ) {
        return ApiResponse.ok(pmsImportService.listHistory(page, size));
    }
}

