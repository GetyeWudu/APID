package com.boa.apid.mentoring.trainer.controller;

import com.boa.apid.common.response.ApiResponse;
import com.boa.apid.core.auth.security.ApidUserPrincipal;
import com.boa.apid.mentoring.trainer.dto.MentoringHrOverviewDto;
import com.boa.apid.mentoring.trainer.dto.TrainerAppointmentRequest;
import com.boa.apid.mentoring.trainer.dto.TrainerDirectoryDto;
import com.boa.apid.mentoring.trainer.dto.TrainerEmployeeCandidateDto;
import com.boa.apid.mentoring.trainer.dto.TrainerProfileRequest;
import com.boa.apid.mentoring.trainer.dto.TrainerRosterDto;
import com.boa.apid.mentoring.trainer.dto.TrainerStatusRequest;
import com.boa.apid.mentoring.trainer.service.TrainerAuthorizationService;
import com.boa.apid.mentoring.trainer.service.MentoringReportExportService;
import jakarta.validation.Valid;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/v1/mentoring")
public class TrainerAuthorizationController {

    private final TrainerAuthorizationService authorizationService;
    private final MentoringReportExportService reportExportService;

    public TrainerAuthorizationController(
            TrainerAuthorizationService authorizationService,
            MentoringReportExportService reportExportService
    ) {
        this.authorizationService = authorizationService;
        this.reportExportService = reportExportService;
    }

    @GetMapping("/directory")
    @PreAuthorize("isAuthenticated() and !principal.mustChangePassword and hasAuthority('EMPLOYEE_PORTAL_ACCESS')")
    public ApiResponse<List<TrainerDirectoryDto>> listDirectory(
            @RequestParam(required = false) Long skillId,
            @RequestParam(required = false) String department
    ) {
        return ApiResponse.ok(authorizationService.listDirectory(skillId, department));
    }

    @GetMapping("/hr/trainers")
    @PreAuthorize("hasAnyAuthority('TRAINER_STATUS_MANAGE', 'TRAINER_DIRECT_APPOINT', 'MENTORING_REPORT_VIEW_ALL', 'MENTORING_MATCH_MANAGE')")
    public ApiResponse<List<TrainerRosterDto>> listRoster() {
        return ApiResponse.ok(authorizationService.listRoster());
    }

    @GetMapping("/hr/employees")
    @PreAuthorize("hasAuthority('TRAINER_DIRECT_APPOINT')")
    public ApiResponse<List<TrainerEmployeeCandidateDto>> listAppointmentCandidates() {
        return ApiResponse.ok(authorizationService.listAppointmentCandidates());
    }

    @GetMapping("/hr/matching-employees")
    @PreAuthorize("hasAuthority('MENTORING_MATCH_MANAGE')")
    public ApiResponse<List<TrainerEmployeeCandidateDto>> listMatchingEmployees() {
        return ApiResponse.ok(authorizationService.listMatchingEmployees());
    }

    @PostMapping("/hr/trainers")
    @PreAuthorize("hasAuthority('TRAINER_DIRECT_APPOINT')")
    public ApiResponse<TrainerRosterDto> appoint(
            @Valid @RequestBody TrainerAppointmentRequest request,
            @AuthenticationPrincipal ApidUserPrincipal actor
    ) {
        return ApiResponse.ok(
                "Trainer appointed",
                authorizationService.appoint(request, actor)
        );
    }

    @PatchMapping("/hr/trainers/{authorizationId}/status")
    @PreAuthorize("hasAuthority('TRAINER_STATUS_MANAGE')")
    public ApiResponse<TrainerRosterDto> changeStatus(
            @PathVariable Long authorizationId,
            @Valid @RequestBody TrainerStatusRequest request,
            @AuthenticationPrincipal ApidUserPrincipal actor
    ) {
        return ApiResponse.ok(
                "Trainer authorization updated",
                authorizationService.changeStatus(authorizationId, request, actor)
        );
    }

    @PatchMapping("/trainer-profile")
    @PreAuthorize("isAuthenticated() and !principal.mustChangePassword and hasAuthority('EMPLOYEE_PORTAL_ACCESS')")
    public ApiResponse<TrainerRosterDto> updateOwnProfile(
            @Valid @RequestBody TrainerProfileRequest request,
            @AuthenticationPrincipal ApidUserPrincipal actor
    ) {
        return ApiResponse.ok(
                "Mentor profile updated",
                authorizationService.updateOwnProfile(request, actor)
        );
    }

    @GetMapping("/trainer-profile")
    @PreAuthorize("isAuthenticated() and !principal.mustChangePassword and hasAuthority('EMPLOYEE_PORTAL_ACCESS')")
    public ApiResponse<TrainerRosterDto> getOwnProfile(
            @AuthenticationPrincipal ApidUserPrincipal actor
    ) {
        return ApiResponse.ok(authorizationService.getOwnProfile(actor));
    }

    @GetMapping("/hr/overview")
    @PreAuthorize("hasAuthority('MENTORING_REPORT_VIEW_ALL')")
    public ApiResponse<MentoringHrOverviewDto> getOverview() {
        return ApiResponse.ok(authorizationService.getOverview());
    }

    @GetMapping("/hr/reports/export")
    @PreAuthorize("hasAuthority('MENTORING_REPORT_VIEW_ALL')")
    public ResponseEntity<byte[]> exportReport(
            @RequestParam String format,
            @AuthenticationPrincipal ApidUserPrincipal actor
    ) {
        MentoringReportExportService.ExportedReport report = reportExportService.export(format, actor);
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(report.contentType()))
                .header(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition.attachment()
                        .filename(report.fileName())
                        .build()
                        .toString())
                .body(report.content());
    }
}
