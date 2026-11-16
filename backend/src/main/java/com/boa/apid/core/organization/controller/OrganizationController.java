package com.boa.apid.core.organization.controller;

import com.boa.apid.common.response.ApiResponse;
import com.boa.apid.core.auth.security.ApidUserPrincipal;
import com.boa.apid.core.organization.dto.*;
import com.boa.apid.core.organization.entity.EmploymentStatus;
import com.boa.apid.core.organization.entity.OrgImportRowStatus;
import com.boa.apid.core.organization.service.EmployeeQueryService;
import com.boa.apid.core.organization.service.OrgImportService;
import com.boa.apid.core.organization.service.OrganizationService;
import jakarta.validation.Valid;
import org.springframework.data.domain.Page;
import org.springframework.http.MediaType;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.Objects;
import java.util.Set;

@RestController
@RequestMapping("/api/v1/core")
public class OrganizationController {

    private final OrganizationService organizationService;
    private final EmployeeQueryService employeeQueryService;
    private final OrgImportService orgImportService;

    public OrganizationController(
            OrganizationService organizationService,
            EmployeeQueryService employeeQueryService,
            OrgImportService orgImportService
    ) {
        this.organizationService = organizationService;
        this.employeeQueryService = employeeQueryService;
        this.orgImportService = orgImportService;
    }

    @GetMapping("/employees/me")
    @PreAuthorize("hasAnyAuthority('EMPLOYEE_PORTAL_ACCESS', 'HIERARCHY_MANAGE', 'USER_MANAGE')")
    public ApiResponse<EmployeeDto> myProfile(@AuthenticationPrincipal ApidUserPrincipal actor) {
        return ApiResponse.ok(employeeQueryService.getByUserId(actor.getUserId()));
    }

    @GetMapping("/employees/me/direct-reports")
    @PreAuthorize("hasAnyAuthority('EMPLOYEE_PORTAL_ACCESS', 'COACHING_REQUEST_SUBMIT', 'HIERARCHY_MANAGE', 'USER_MANAGE')")
    public ApiResponse<List<EmployeeDto>> myDirectReports(@AuthenticationPrincipal ApidUserPrincipal actor) {
        return ApiResponse.ok(employeeQueryService.getDirectReportsForUser(actor.getUserId()));
    }

    @GetMapping("/employees")
    @PreAuthorize("hasAnyAuthority('EMPLOYEE_PORTAL_ACCESS', 'HIERARCHY_MANAGE', 'COACHING_ASSIGNMENT_VIEW_ALL', 'COACHING_REQUEST_APPROVE', 'TRAINER_APPLICATION_REVIEW', 'MENTORING_MATCH_MANAGE')")
    public ApiResponse<Page<EmployeeDto>> listEmployees(
            @RequestParam(required = false) String search,
            @RequestParam(required = false) Long departmentId,
            @RequestParam(required = false) EmploymentStatus status,
            @RequestParam(required = false) Long managerId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size
    ) {
        return ApiResponse.ok(employeeQueryService.searchEmployees(search, departmentId, status, managerId, page, size));
    }

    @GetMapping("/employees/{id}")
    @PreAuthorize("hasAnyAuthority('EMPLOYEE_PORTAL_ACCESS', 'HIERARCHY_MANAGE', 'COACHING_ASSIGNMENT_VIEW_ALL', 'COACHING_REQUEST_APPROVE', 'TRAINER_APPLICATION_REVIEW', 'MENTORING_MATCH_MANAGE')")
    public ApiResponse<EmployeeDto> getEmployee(@PathVariable Long id) {
        return ApiResponse.ok(employeeQueryService.getById(id));
    }

    private static final Set<String> ORG_HIERARCHY_READ_PERMS = Set.of(
            "HIERARCHY_MANAGE", "COACHING_ASSIGNMENT_VIEW_ALL", "COACHING_REQUEST_APPROVE"
    );

    @GetMapping("/employees/{id}/manager")
    @PreAuthorize("hasAnyAuthority('EMPLOYEE_PORTAL_ACCESS', 'HIERARCHY_MANAGE', 'COACHING_REQUEST_APPROVE', 'COACHING_ASSIGNMENT_VIEW_ALL')")
    public ApiResponse<EmployeeDto> getDirectManager(
            @PathVariable Long id,
            @AuthenticationPrincipal ApidUserPrincipal actor
    ) {
        requireSelfOrOrgHierarchyScope(id, actor);
        return ApiResponse.ok(employeeQueryService.getDirectManager(id).orElse(null));
    }

    @GetMapping("/employees/{id}/direct-reports")
    @PreAuthorize("hasAnyAuthority('EMPLOYEE_PORTAL_ACCESS', 'HIERARCHY_MANAGE', 'COACHING_REQUEST_APPROVE', 'COACHING_ASSIGNMENT_VIEW_ALL')")
    public ApiResponse<List<EmployeeDto>> getDirectReports(
            @PathVariable Long id,
            @AuthenticationPrincipal ApidUserPrincipal actor
    ) {
        requireSelfOrOrgHierarchyScope(id, actor);
        return ApiResponse.ok(employeeQueryService.getDirectReports(id));
    }

    private void requireSelfOrOrgHierarchyScope(Long targetEmployeeId, ApidUserPrincipal actor) {
        if (actor == null) {
            throw new AccessDeniedException("Authentication required");
        }
        boolean hasOrgScope = actor.getPermissions().stream().anyMatch(ORG_HIERARCHY_READ_PERMS::contains);
        if (hasOrgScope) {
            return;
        }
        Long selfEmployeeId = employeeQueryService.findByUserId(actor.getUserId())
                .map(EmployeeDto::id)
                .orElse(null);
        if (!Objects.equals(selfEmployeeId, targetEmployeeId)) {
            throw new AccessDeniedException("You are only permitted to inspect your own reporting scope");
        }
    }

    @GetMapping("/departments")
    @PreAuthorize("hasAnyAuthority('EMPLOYEE_PORTAL_ACCESS', 'HIERARCHY_MANAGE', 'COACHING_ASSIGNMENT_VIEW_ALL', 'MENTORING_MATCH_MANAGE')")
    public ApiResponse<List<DepartmentDto>> listDepartments(
            @RequestParam(defaultValue = "true") boolean activeOnly
    ) {
        return ApiResponse.ok(organizationService.listDepartments(activeOnly));
    }

    @PostMapping("/admin/departments")
    @PreAuthorize("hasAuthority('HIERARCHY_MANAGE')")
    public ApiResponse<DepartmentDto> createDepartment(
            @Valid @RequestBody CreateDepartmentRequest request,
            @AuthenticationPrincipal ApidUserPrincipal actor
    ) {
        return ApiResponse.ok("Department created", organizationService.createDepartment(request, actor));
    }

    @PutMapping("/admin/departments/{id}")
    @PreAuthorize("hasAuthority('HIERARCHY_MANAGE')")
    public ApiResponse<DepartmentDto> updateDepartment(
            @PathVariable Long id,
            @Valid @RequestBody UpdateDepartmentRequest request,
            @AuthenticationPrincipal ApidUserPrincipal actor
    ) {
        return ApiResponse.ok("Department updated", organizationService.updateDepartment(id, request, actor));
    }

    @PostMapping("/admin/employees")
    @PreAuthorize("hasAuthority('HIERARCHY_MANAGE')")
    public ApiResponse<EmployeeDto> createEmployee(
            @Valid @RequestBody CreateEmployeeRequest request,
            @AuthenticationPrincipal ApidUserPrincipal actor
    ) {
        return ApiResponse.ok("Employee created", organizationService.createEmployee(request, actor));
    }

    @PutMapping("/admin/employees/{id}")
    @PreAuthorize("hasAuthority('HIERARCHY_MANAGE')")
    public ApiResponse<EmployeeDto> updateEmployee(
            @PathVariable Long id,
            @Valid @RequestBody UpdateEmployeeRequest request,
            @AuthenticationPrincipal ApidUserPrincipal actor
    ) {
        return ApiResponse.ok("Employee updated", organizationService.updateEmployee(id, request, actor));
    }

    @PostMapping("/admin/employees/{id}/create-and-link-user")
    @PreAuthorize("hasAuthority('HIERARCHY_MANAGE') and hasAuthority('USER_MANAGE')")
    public ApiResponse<CreateAndLinkEmployeeUserResponse> createAndLinkEmployeeUser(
            @PathVariable Long id,
            @Valid @RequestBody CreateEmployeeUserRequest request,
            @AuthenticationPrincipal ApidUserPrincipal actor
    ) {
        return ApiResponse.ok(
                "User account created and linked to employee",
                organizationService.createAndLinkUser(id, request, actor)
        );
    }

    @DeleteMapping("/admin/employees/{id}/revoke-user-link")
    @PreAuthorize("hasAuthority('HIERARCHY_MANAGE') and hasAuthority('USER_MANAGE')")
    public ApiResponse<EmployeeDto> revokeEmployeeUserLink(
            @PathVariable Long id,
            @AuthenticationPrincipal ApidUserPrincipal actor
    ) {
        return ApiResponse.ok(
                "Employee login link revoked and account deleted",
                organizationService.revokeUserLink(id, actor)
        );
    }

    @PostMapping("/admin/employees/{id}/link-user")
    @PreAuthorize("hasAuthority('HIERARCHY_MANAGE')")
    public ApiResponse<EmployeeDto> linkEmployeeUser(
            @PathVariable Long id,
            @Valid @RequestBody LinkEmployeeUserRequest request,
            @AuthenticationPrincipal ApidUserPrincipal actor
    ) {
        return ApiResponse.ok("User account linked to employee", organizationService.linkUser(id, request.userId(), actor));
    }

    @DeleteMapping("/admin/employees/{id}/link-user")
    @PreAuthorize("hasAuthority('HIERARCHY_MANAGE')")
    public ApiResponse<EmployeeDto> unlinkEmployeeUser(
            @PathVariable Long id,
            @AuthenticationPrincipal ApidUserPrincipal actor
    ) {
        return ApiResponse.ok("User account unlinked from employee", organizationService.unlinkUser(id, actor));
    }

    @PostMapping(value = "/admin/employees/import/preview", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize("hasAuthority('HIERARCHY_MANAGE')")
    public ApiResponse<OrgImportPreviewDto> previewOrganizationImport(
            @RequestParam("file") MultipartFile file,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "25") int size,
            @AuthenticationPrincipal ApidUserPrincipal actor
    ) {
        return ApiResponse.ok("Organization import preview generated",
                orgImportService.previewImport(file, page, size, actor));
    }

    @GetMapping("/admin/employees/import/batches/{batchId}")
    @PreAuthorize("hasAuthority('HIERARCHY_MANAGE')")
    public ApiResponse<OrgImportPreviewDto> getOrganizationImportBatch(
            @PathVariable Long batchId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "25") int size,
            @RequestParam(required = false) OrgImportRowStatus rowStatus,
            @AuthenticationPrincipal ApidUserPrincipal actor
    ) {
        return ApiResponse.ok(orgImportService.getBatchPreview(batchId, page, size, rowStatus, actor));
    }

    @PostMapping("/admin/employees/import/batches/{batchId}/commit")
    @PreAuthorize("hasAuthority('HIERARCHY_MANAGE')")
    public ApiResponse<OrgImportCommitResultDto> commitOrganizationImportBatch(
            @PathVariable Long batchId,
            @AuthenticationPrincipal ApidUserPrincipal actor
    ) {
        return ApiResponse.ok("Organization import batch committed",
                orgImportService.commitBatch(batchId, actor));
    }

    @DeleteMapping("/admin/employees/import/batches/{batchId}")
    @PreAuthorize("hasAuthority('HIERARCHY_MANAGE')")
    public ApiResponse<Void> cancelOrganizationImportBatch(
            @PathVariable Long batchId,
            @AuthenticationPrincipal ApidUserPrincipal actor
    ) {
        orgImportService.cancelBatch(batchId, actor);
        return ApiResponse.ok("Organization import batch cancelled", null);
    }

    @GetMapping("/admin/employees/unlinked-users")
    @PreAuthorize("hasAuthority('HIERARCHY_MANAGE')")
    public ApiResponse<List<UserAccountSummaryDto>> listUnlinkedUsers(
            @RequestParam(required = false) Long includeUserId,
            @RequestParam(required = false) String search
    ) {
        return ApiResponse.ok(organizationService.listAvailableUsers(includeUserId, search));
    }
}

