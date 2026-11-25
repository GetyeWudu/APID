package com.boa.apid.core.organization;

import com.boa.apid.core.organization.dto.OrganizationLocationDto;
import com.boa.apid.core.organization.entity.Department;
import com.boa.apid.core.organization.entity.Employee;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;

class OrganizationLocationDtoTest {

    @Test
    void buildsPathFromRootDepartmentToEmployeeDepartment() {
        Department district = department(1L, "North District", null);
        Department branch = department(2L, "Central Branch", district);
        Department team = department(3L, "Digital Services", branch);
        Employee employee = new Employee();
        employee.setDepartment(team);

        assertEquals(
                List.of(
                        new OrganizationLocationDto("department:1", "North District"),
                        new OrganizationLocationDto("department:2", "Central Branch"),
                        new OrganizationLocationDto("department:3", "Digital Services")
                ),
                OrganizationLocationDto.path(employee)
        );
    }

    @Test
    void usesFlatOrganizationNamesWhenDepartmentIsNotLinked() {
        Employee employee = new Employee();
        employee.setParentDepartmentName("North District");
        employee.setDepartmentName("Central Branch");

        assertEquals(
                List.of(
                        new OrganizationLocationDto("legacy:parent:north district", "North District"),
                        new OrganizationLocationDto("legacy:department:central branch", "Central Branch")
                ),
                OrganizationLocationDto.path(employee)
        );
    }

    private Department department(Long id, String name, Department parent) {
        Department department = new Department();
        department.setId(id);
        department.setName(name);
        department.setParentDepartment(parent);
        return department;
    }
}
