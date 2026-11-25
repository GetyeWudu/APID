package com.boa.apid.core.organization.dto;

import com.boa.apid.core.organization.entity.Department;
import com.boa.apid.core.organization.entity.Employee;

import java.util.ArrayList;
import java.util.Collections;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;

public record OrganizationLocationDto(String id, String name) {

    public static List<OrganizationLocationDto> path(Employee employee) {
        List<OrganizationLocationDto> path = new ArrayList<>();
        Department department = employee.getDepartment();
        Set<Long> visited = new HashSet<>();
        while (department != null && visited.add(department.getId())) {
            path.add(new OrganizationLocationDto(
                    "department:" + department.getId(),
                    department.getName()
            ));
            department = department.getParentDepartment();
        }
        if (!path.isEmpty()) {
            Collections.reverse(path);
            String legacyParentName = employee.getParentDepartmentName();
            if (path.size() == 1
                    && legacyParentName != null
                    && !legacyParentName.isBlank()
                    && !legacyParentName.equalsIgnoreCase(path.get(0).name())) {
                path.add(0, new OrganizationLocationDto(
                        "legacy:parent:" + legacyParentName.trim().toLowerCase(Locale.ROOT),
                        legacyParentName.trim()
                ));
            }
            return List.copyOf(path);
        }

        addLegacyLocation(path, "parent", employee.getParentDepartmentName());
        addLegacyLocation(path, "department", employee.getDepartmentName());
        return List.copyOf(path);
    }

    private static void addLegacyLocation(
            List<OrganizationLocationDto> path,
            String level,
            String name
    ) {
        if (name == null || name.isBlank()) {
            return;
        }
        String normalized = name.trim().toLowerCase(Locale.ROOT);
        path.add(new OrganizationLocationDto("legacy:" + level + ":" + normalized, name.trim()));
    }
}
