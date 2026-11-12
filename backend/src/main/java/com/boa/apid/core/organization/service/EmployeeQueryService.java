package com.boa.apid.core.organization.service;

import com.boa.apid.common.exception.ResourceNotFoundException;
import com.boa.apid.core.authorization.entity.User;
import com.boa.apid.core.authorization.repository.UserRepository;
import com.boa.apid.core.organization.dto.EmployeeDto;
import com.boa.apid.core.organization.entity.Employee;
import com.boa.apid.core.organization.entity.EmploymentStatus;
import com.boa.apid.core.organization.repository.EmployeeRepository;
import jakarta.persistence.criteria.Predicate;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;

/**
 * Shared read contract for Core, Coaching, and Mentoring modules to query employees and reporting lines.
 */
@Service
@Transactional(readOnly = true)
public class EmployeeQueryService {

    private static final int MAX_PAGE_SIZE = 100;

    private final EmployeeRepository employeeRepository;
    private final UserRepository userRepository;

    public EmployeeQueryService(EmployeeRepository employeeRepository, UserRepository userRepository) {
        this.employeeRepository = employeeRepository;
        this.userRepository = userRepository;
    }

    public EmployeeDto getById(Long employeeId) {
        return findById(employeeId)
                .orElseThrow(() -> new ResourceNotFoundException("Employee not found"));
    }

    public Optional<EmployeeDto> findById(Long employeeId) {
        if (employeeId == null) {
            return Optional.empty();
        }
        return employeeRepository.findDetailedById(employeeId).map(this::toDtoWithUsername);
    }

    public EmployeeDto getByUserId(Long userId) {
        return findByUserId(userId)
                .orElseThrow(() -> new ResourceNotFoundException("No employee profile is linked to this user account"));
    }

    public Optional<EmployeeDto> findByUserId(Long userId) {
        if (userId == null) {
            return Optional.empty();
        }
        return employeeRepository.findDetailedByUserId(userId).map(this::toDtoWithUsername);
    }

    public EmployeeDto getByEmployeeNumber(String employeeNumber) {
        return findByEmployeeNumber(employeeNumber)
                .orElseThrow(() -> new ResourceNotFoundException("Employee not found"));
    }

    public Optional<EmployeeDto> findByEmployeeNumber(String employeeNumber) {
        if (employeeNumber == null || employeeNumber.isBlank()) {
            return Optional.empty();
        }
        return employeeRepository.findDetailedByEmployeeNumberIgnoreCase(employeeNumber.trim())
                .map(this::toDtoWithUsername);
    }

    public Optional<EmployeeDto> getDirectManager(Long employeeId) {
        Employee employee = employeeRepository.findDetailedById(employeeId)
                .orElseThrow(() -> new ResourceNotFoundException("Employee not found"));
        Employee manager = employee.getManager();
        if (manager == null) {
            return Optional.empty();
        }
        return employeeRepository.findDetailedById(manager.getId()).map(this::toDtoWithUsername);
    }

    public List<EmployeeDto> getDirectReports(Long managerEmployeeId) {
        if (!employeeRepository.existsById(managerEmployeeId)) {
            throw new ResourceNotFoundException("Manager employee not found");
        }
        return toDtosWithUsernames(employeeRepository.findAllByManager_IdOrderByFullNameAsc(managerEmployeeId));
    }

    public List<EmployeeDto> getDirectReportsForUser(Long userId) {
        return findByUserId(userId)
                .map(emp -> toDtosWithUsernames(employeeRepository.findAllByManager_IdOrderByFullNameAsc(emp.id())))
                .orElseGet(List::of);
    }

    public boolean isDirectManager(Long managerEmployeeId, Long subordinateEmployeeId) {
        if (managerEmployeeId == null || subordinateEmployeeId == null) {
            return false;
        }
        return employeeRepository.findDetailedById(subordinateEmployeeId)
                .map(Employee::getManager)
                .map(Employee::getId)
                .filter(id -> id.equals(managerEmployeeId))
                .isPresent();
    }

    public Page<EmployeeDto> searchEmployees(
            String search,
            Long departmentId,
            EmploymentStatus status,
            Long managerId,
            int page,
            int size
    ) {
        int safePage = Math.max(0, page);
        int safeSize = Math.min(Math.max(1, size), MAX_PAGE_SIZE);
        Pageable pageable = PageRequest.of(safePage, safeSize, Sort.by(Sort.Direction.ASC, "fullName"));

        String normalizedSearch = search == null || search.isBlank() ? null : search.trim().toLowerCase(Locale.ROOT);

        Specification<Employee> spec = (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();
            if (departmentId != null) {
                predicates.add(cb.equal(root.get("department").get("id"), departmentId));
            }
            if (status != null) {
                predicates.add(cb.equal(root.get("employmentStatus"), status));
            }
            if (managerId != null) {
                predicates.add(cb.equal(root.get("manager").get("id"), managerId));
            }
            if (normalizedSearch != null) {
                String pattern = "%" + normalizedSearch + "%";
                predicates.add(cb.or(
                        cb.like(cb.lower(root.get("employeeNumber")), pattern),
                        cb.like(cb.lower(root.get("fullName")), pattern),
                        cb.like(cb.lower(cb.coalesce(root.get("email"), "")), pattern),
                        cb.like(cb.lower(cb.coalesce(root.get("position"), "")), pattern),
                        cb.like(cb.lower(cb.coalesce(root.get("job"), "")), pattern),
                        cb.like(cb.lower(cb.coalesce(root.get("departmentName"), "")), pattern)
                ));
            }
            return cb.and(predicates.toArray(Predicate[]::new));
        };

        Page<Employee> result = employeeRepository.findAll(spec, pageable);
        Map<Long, String> usernames = loadUsernames(result.getContent());
        return result.map(emp -> EmployeeDto.from(emp, emp.getUserId() != null ? usernames.get(emp.getUserId()) : null));
    }

    EmployeeDto toDtoWithUsername(Employee employee) {
        String username = null;
        if (employee.getUserId() != null) {
            username = userRepository.findById(employee.getUserId()).map(User::getUsername).orElse(null);
        }
        return EmployeeDto.from(employee, username);
    }

    private List<EmployeeDto> toDtosWithUsernames(List<Employee> employees) {
        Map<Long, String> usernames = loadUsernames(employees);
        return employees.stream()
                .map(emp -> EmployeeDto.from(emp, emp.getUserId() != null ? usernames.get(emp.getUserId()) : null))
                .toList();
    }

    private Map<Long, String> loadUsernames(List<Employee> employees) {
        List<Long> userIds = employees.stream()
                .map(Employee::getUserId)
                .filter(Objects::nonNull)
                .distinct()
                .toList();
        if (userIds.isEmpty()) {
            return Map.of();
        }
        Map<Long, String> map = new HashMap<>();
        for (User user : userRepository.findAllById(userIds)) {
            map.put(user.getId(), user.getUsername());
        }
        return map;
    }
}

