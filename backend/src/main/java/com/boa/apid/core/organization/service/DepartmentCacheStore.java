package com.boa.apid.core.organization.service;

import com.boa.apid.core.organization.dto.DepartmentDto;
import com.boa.apid.core.organization.entity.Department;
import com.boa.apid.core.organization.repository.DepartmentRepository;
import com.boa.apid.core.organization.repository.EmployeeRepository;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

@Component
public class DepartmentCacheStore {

    private final DepartmentRepository departmentRepository;
    private final EmployeeRepository employeeRepository;

    public DepartmentCacheStore(
            DepartmentRepository departmentRepository,
            EmployeeRepository employeeRepository
    ) {
        this.departmentRepository = departmentRepository;
        this.employeeRepository = employeeRepository;
    }

    @Cacheable(cacheNames = "org_departments", key = "'active'")
    public ArrayList<DepartmentDto> getActiveDepartmentsCached() {
        return toDtos(departmentRepository.findAllByActiveTrueOrderByNameAsc());
    }

    @Cacheable(cacheNames = "org_departments", key = "'all'")
    public ArrayList<DepartmentDto> getAllDepartmentsCached() {
        return toDtos(departmentRepository.findAllByOrderByNameAsc());
    }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT, fallbackExecution = true)
    @CacheEvict(cacheNames = "org_departments", allEntries = true)
    public void onDepartmentChanged(DepartmentCacheInvalidationEvent event) {
        // Eviction handled via @CacheEvict after transaction commits.
    }

    private ArrayList<DepartmentDto> toDtos(List<Department> departments) {
        List<Long> headIds = departments.stream()
                .map(Department::getHeadEmployeeId)
                .filter(Objects::nonNull)
                .distinct()
                .toList();

        Map<Long, String> headNames = new HashMap<>();
        if (!headIds.isEmpty()) {
            for (Object[] row : employeeRepository.findNamesByIds(headIds)) {
                headNames.put((Long) row[0], (String) row[1]);
            }
        }

        ArrayList<DepartmentDto> result = new ArrayList<>(departments.size());
        for (Department dept : departments) {
            String headName = dept.getHeadEmployeeId() != null ? headNames.get(dept.getHeadEmployeeId()) : null;
            result.add(DepartmentDto.from(dept, headName));
        }
        return result;
    }
}

