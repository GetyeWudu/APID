package com.boa.apid.core.organization.dto;

import com.boa.apid.core.organization.entity.Department;
import com.boa.apid.core.organization.entity.Employee;
import com.boa.apid.core.organization.entity.EmploymentStatus;

import java.time.Instant;

public record EmployeeDto(
        Long id,
        Long userId,
        String username,
        String employeeNumber,
        String fullName,
        String email,
        String gender,
        Long departmentId,
        String departmentName,
        String parentDepartmentName,
        String job,
        String position,
        Long managerId,
        String managerEmployeeNumber,
        String managerFullName,
        EmploymentStatus employmentStatus,
        Instant createdAt,
        Instant updatedAt
) {
    public static EmployeeDto from(Employee employee, String username) {
        Department dept = employee.getDepartment();
        Employee manager = employee.getManager();

        String resolvedDeptName = dept != null ? dept.getName() : employee.getDepartmentName();
        String resolvedParentDeptName = dept != null
                ? (dept.getParentDepartment() != null ? dept.getParentDepartment().getName() : employee.getParentDepartmentName())
                : employee.getParentDepartmentName();

        return new EmployeeDto(
                employee.getId(),
                employee.getUserId(),
                username,
                employee.getEmployeeNumber(),
                employee.getFullName(),
                employee.getEmail(),
                employee.getGender(),
                dept != null ? dept.getId() : null,
                resolvedDeptName,
                resolvedParentDeptName,
                employee.getJob(),
                employee.getPosition(),
                manager != null ? manager.getId() : null,
                manager != null ? manager.getEmployeeNumber() : null,
                manager != null ? manager.getFullName() : null,
                employee.getEmploymentStatus(),
                employee.getCreatedAt(),
                employee.getUpdatedAt()
        );
    }
}

