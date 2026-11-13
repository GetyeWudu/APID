package com.boa.apid.coaching.assignment.controller;

import com.boa.apid.coaching.assignment.dto.*;
import com.boa.apid.coaching.assignment.entity.AssignmentClosureReason;
import com.boa.apid.coaching.assignment.entity.AssignmentPathway;
import com.boa.apid.coaching.assignment.entity.AssignmentStatus;
import com.boa.apid.coaching.assignment.service.CoachingAssignmentService;
import com.boa.apid.common.response.ApiResponse;
import com.boa.apid.core.auth.security.ApidUserPrincipal;
import jakarta.validation.Valid;
import org.springframework.data.domain.Page;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/coaching")
public class CoachingAssignmentController {

    private final CoachingAssignmentService assignmentService;

    public CoachingAssignmentController(CoachingAssignmentService assignmentService) {
        this.assignmentService = assignmentService;
    }

    /**
     * Search & filter organization-wide coaching assignments (PMS Admin).
     */
    @GetMapping("/assignments")
    @PreAuthorize("hasAuthority('COACHING_ASSIGNMENT_VIEW_ALL')")
    public ApiResponse<Page<CoachingAssignmentDto>> searchAssignments(
            @RequestParam(value = "performanceFiscalQuarterId", required = false) Long performanceFiscalQuarterId,
            @RequestParam(value = "coachingFiscalQuarterId", required = false) Long coachingFiscalQuarterId,
            @RequestParam(value = "pathway", required = false) AssignmentPathway pathway,
            @RequestParam(value = "status", required = false) AssignmentStatus status,
            @RequestParam(value = "closureReason", required = false) AssignmentClosureReason closureReason,
            @RequestParam(value = "atRisk", required = false) Boolean atRisk,
            @RequestParam(value = "search", required = false) String search,
            @RequestParam(value = "department", required = false) String department,
            @RequestParam(value = "page", defaultValue = "0") int page,
            @RequestParam(value = "size", defaultValue = "20") int size
    ) {
        return ApiResponse.ok(assignmentService.searchAssignments(
                performanceFiscalQuarterId,
                coachingFiscalQuarterId,
                pathway,
                status,
                closureReason,
                atRisk,
                search,
                department,
                page,
                size
        ));
    }

    /**
     * Get detailed view of an assignment with goal lines and replacement history.
     */
    @GetMapping("/assignments/{id}")
    @PreAuthorize("hasAnyAuthority('COACHING_ASSIGNMENT_VIEW_ALL', 'EMPLOYEE_PORTAL_ACCESS')")
    public ApiResponse<CoachingAssignmentDetailDto> getAssignmentDetail(
            @PathVariable Long id,
            @AuthenticationPrincipal ApidUserPrincipal actor
    ) {
        return ApiResponse.ok(assignmentService.getAssignmentDetail(id, actor));
    }

    /**
     * Get detailed individual PMS goals and evaluation scores for an employee.
     * Accessible by PMS Admin, the employee, their line manager, or their assigned coach.
     */
    @GetMapping("/employees/{employeeId}/performance-goals")
    @PreAuthorize("hasAnyAuthority('COACHING_ASSIGNMENT_VIEW_ALL', 'EMPLOYEE_PORTAL_ACCESS')")
    public ApiResponse<EmployeePerformanceGoalsDto> getEmployeePerformanceGoals(
            @PathVariable Long employeeId,
            @AuthenticationPrincipal ApidUserPrincipal actor
    ) {
        return ApiResponse.ok(assignmentService.getEmployeePerformanceGoals(employeeId, actor));
    }

    /**
     * Resolve a PENDING_COACH_ASSIGNMENT by assigning an active bank coach.
     */
    @PostMapping("/assignments/{id}/assign-coach")
    @PreAuthorize("hasAuthority('COACHING_COACH_REPLACE')")
    public ApiResponse<CoachingAssignmentDto> assignCoach(
            @PathVariable Long id,
            @Valid @RequestBody AssignCoachRequest request,
            @AuthenticationPrincipal ApidUserPrincipal actor
    ) {
        return ApiResponse.ok(assignmentService.assignCoach(id, request, actor));
    }

    /**
     * Mid-quarter coach reassignment with audit history.
     */
    @PostMapping("/assignments/{id}/replace-coach")
    @PreAuthorize("hasAuthority('COACHING_COACH_REPLACE')")
    public ApiResponse<CoachingAssignmentDto> replaceCoach(
            @PathVariable Long id,
            @Valid @RequestBody ReplaceCoachRequest request,
            @AuthenticationPrincipal ApidUserPrincipal actor
    ) {
        return ApiResponse.ok(assignmentService.replaceCoach(id, request, actor));
    }

    /**
     * Administratively close an active or pending coaching assignment.
     */
    @PostMapping("/assignments/{id}/close")
    @PreAuthorize("hasAuthority('COACHING_COACH_REPLACE')")
    public ApiResponse<Void> closeAssignment(
            @PathVariable Long id,
            @Valid @RequestBody CloseAssignmentRequest request,
            @AuthenticationPrincipal ApidUserPrincipal actor
    ) {
        assignmentService.closeAssignment(id, request, actor);
        return ApiResponse.ok(null);
    }

    /**
     * Personal talent workspace: view active coaching plan(s) and triggering PMS goal lines.
     */
    @GetMapping("/my-coaching")
    @PreAuthorize("hasAuthority('EMPLOYEE_PORTAL_ACCESS')")
    public ApiResponse<MyCoachingWorkspaceDto> getMyCoaching(
            @AuthenticationPrincipal ApidUserPrincipal actor
    ) {
        return ApiResponse.ok(assignmentService.getMyCoaching(actor));
    }

    /**
     * Personal coach workspace: view assigned coachees.
     */
    @GetMapping("/my-coachees")
    @PreAuthorize("hasAuthority('EMPLOYEE_PORTAL_ACCESS')")
    public ApiResponse<List<MyCoacheeItemDto>> getMyCoachees(
            @AuthenticationPrincipal ApidUserPrincipal actor
    ) {
        return ApiResponse.ok(assignmentService.getMyCoachees(actor));
    }
}

