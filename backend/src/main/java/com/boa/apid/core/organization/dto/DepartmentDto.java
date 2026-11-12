package com.boa.apid.core.organization.dto;

import com.boa.apid.core.organization.entity.Department;

import java.time.Instant;

/**
 * Non-final DTO with public no-arg constructor so Redis GenericJackson2JsonRedisSerializer
 * (DefaultTyping.NON_FINAL) preserves element types in cached department lists.
 */
public class DepartmentDto {

    private Long id;
    private String code;
    private String name;
    private Long parentDepartmentId;
    private String parentDepartmentName;
    private Long headEmployeeId;
    private String headEmployeeName;
    private boolean active;
    private Instant createdAt;
    private Instant updatedAt;

    public DepartmentDto() {
    }

    public DepartmentDto(
            Long id,
            String code,
            String name,
            Long parentDepartmentId,
            String parentDepartmentName,
            Long headEmployeeId,
            String headEmployeeName,
            boolean active,
            Instant createdAt,
            Instant updatedAt
    ) {
        this.id = id;
        this.code = code;
        this.name = name;
        this.parentDepartmentId = parentDepartmentId;
        this.parentDepartmentName = parentDepartmentName;
        this.headEmployeeId = headEmployeeId;
        this.headEmployeeName = headEmployeeName;
        this.active = active;
        this.createdAt = createdAt;
        this.updatedAt = updatedAt;
    }

    public static DepartmentDto from(Department department, String headEmployeeName) {
        Department parent = department.getParentDepartment();
        return new DepartmentDto(
                department.getId(),
                department.getCode(),
                department.getName(),
                parent != null ? parent.getId() : null,
                parent != null ? parent.getName() : null,
                department.getHeadEmployeeId(),
                headEmployeeName,
                department.isActive(),
                department.getCreatedAt(),
                department.getUpdatedAt()
        );
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getCode() {
        return code;
    }

    public void setCode(String code) {
        this.code = code;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public Long getParentDepartmentId() {
        return parentDepartmentId;
    }

    public void setParentDepartmentId(Long parentDepartmentId) {
        this.parentDepartmentId = parentDepartmentId;
    }

    public String getParentDepartmentName() {
        return parentDepartmentName;
    }

    public void setParentDepartmentName(String parentDepartmentName) {
        this.parentDepartmentName = parentDepartmentName;
    }

    public Long getHeadEmployeeId() {
        return headEmployeeId;
    }

    public void setHeadEmployeeId(Long headEmployeeId) {
        this.headEmployeeId = headEmployeeId;
    }

    public String getHeadEmployeeName() {
        return headEmployeeName;
    }

    public void setHeadEmployeeName(String headEmployeeName) {
        this.headEmployeeName = headEmployeeName;
    }

    public boolean isActive() {
        return active;
    }

    public void setActive(boolean active) {
        this.active = active;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(Instant updatedAt) {
        this.updatedAt = updatedAt;
    }
}

