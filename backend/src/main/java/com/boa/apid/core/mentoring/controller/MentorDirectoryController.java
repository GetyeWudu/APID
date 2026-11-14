package com.boa.apid.core.mentoring.controller;

import com.boa.apid.common.response.ApiResponse;
import com.boa.apid.core.mentoring.dto.MentorDirectoryDto;
import com.boa.apid.core.mentoring.service.MentorDirectoryService;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/v1/core")
public class MentorDirectoryController {

    private final MentorDirectoryService mentorDirectoryService;

    public MentorDirectoryController(MentorDirectoryService mentorDirectoryService) {
        this.mentorDirectoryService = mentorDirectoryService;
    }

    @GetMapping("/mentors")
    @PreAuthorize("hasAnyAuthority('EMPLOYEE_PORTAL_ACCESS', 'COACHING_REQUEST_SUBMIT')")
    public ApiResponse<List<MentorDirectoryDto>> listMentors() {
        return ApiResponse.ok(mentorDirectoryService.listActiveMentors());
    }

    @GetMapping("/mentors/count")
    @PreAuthorize("hasAuthority('MENTORING_REPORT_VIEW_ALL')")
    public ApiResponse<Long> countActiveMentors() {
        return ApiResponse.ok(mentorDirectoryService.countActiveMentors());
    }
}
