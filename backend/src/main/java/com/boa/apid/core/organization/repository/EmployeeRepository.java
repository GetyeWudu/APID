package com.boa.apid.core.organization.repository;

import com.boa.apid.core.organization.entity.Employee;
import com.boa.apid.core.organization.entity.EmploymentStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface EmployeeRepository extends JpaRepository<Employee, Long>, JpaSpecificationExecutor<Employee> {

    @Override
    @EntityGraph(attributePaths = {"department", "department.parentDepartment", "manager"})
    Page<Employee> findAll(Specification<Employee> spec, Pageable pageable);

    @Query("""
            SELECT e FROM Employee e
            LEFT JOIN FETCH e.department d
            LEFT JOIN FETCH d.parentDepartment
            LEFT JOIN FETCH e.manager
            WHERE e.id = :id
            """)
    Optional<Employee> findDetailedById(@Param("id") Long id);

    @Query("""
            SELECT e FROM Employee e
            LEFT JOIN FETCH e.department d
            LEFT JOIN FETCH d.parentDepartment
            LEFT JOIN FETCH e.manager
            WHERE e.userId = :userId
            """)
    Optional<Employee> findDetailedByUserId(@Param("userId") Long userId);

    @Query("""
            SELECT e FROM Employee e
            LEFT JOIN FETCH e.department d
            LEFT JOIN FETCH d.parentDepartment
            LEFT JOIN FETCH e.manager
            WHERE e.userId IN :userIds
            """)
    List<Employee> findDetailedByUserIdIn(@Param("userIds") Collection<Long> userIds);

    @Query("""
            SELECT e FROM Employee e
            LEFT JOIN FETCH e.department d
            LEFT JOIN FETCH d.parentDepartment
            LEFT JOIN FETCH e.manager
            WHERE LOWER(e.employeeNumber) = LOWER(:employeeNumber)
            """)
    Optional<Employee> findDetailedByEmployeeNumberIgnoreCase(@Param("employeeNumber") String employeeNumber);

    @Query("""
            SELECT e FROM Employee e
            LEFT JOIN FETCH e.department d
            LEFT JOIN FETCH d.parentDepartment
            LEFT JOIN FETCH e.manager
            WHERE LOWER(e.employeeNumber) IN :employeeNumbers
            """)
    List<Employee> findDetailedByEmployeeNumbersIgnoreCase(@Param("employeeNumbers") java.util.Collection<String> employeeNumbers);

    @Query("SELECT e FROM Employee e WHERE LOWER(e.employeeNumber) = LOWER(:employeeNumber)")
    Optional<Employee> findByEmployeeNumberIgnoreCase(@Param("employeeNumber") String employeeNumber);

    boolean existsByUserId(Long userId);

    boolean existsByUserIdAndIdNot(Long userId, Long id);

    @Query("SELECT CASE WHEN COUNT(e) > 0 THEN true ELSE false END FROM Employee e WHERE LOWER(e.employeeNumber) = LOWER(:employeeNumber)")
    boolean existsByEmployeeNumberIgnoreCase(@Param("employeeNumber") String employeeNumber);

    @Query("SELECT CASE WHEN COUNT(e) > 0 THEN true ELSE false END FROM Employee e WHERE LOWER(e.employeeNumber) = LOWER(:employeeNumber) AND e.id <> :id")
    boolean existsByEmployeeNumberIgnoreCaseAndIdNot(@Param("employeeNumber") String employeeNumber, @Param("id") Long id);

    @Query("SELECT CASE WHEN COUNT(e) > 0 THEN true ELSE false END FROM Employee e WHERE LOWER(e.email) = LOWER(:email)")
    boolean existsByEmailIgnoreCase(@Param("email") String email);

    @Query("SELECT CASE WHEN COUNT(e) > 0 THEN true ELSE false END FROM Employee e WHERE LOWER(e.email) = LOWER(:email) AND e.id <> :id")
    boolean existsByEmailIgnoreCaseAndIdNot(@Param("email") String email, @Param("id") Long id);

    @EntityGraph(attributePaths = {"department", "department.parentDepartment", "manager"})
    List<Employee> findAllByManager_IdOrderByFullNameAsc(Long managerId);

    @Query("""
            SELECT e FROM Employee e
            LEFT JOIN FETCH e.department d
            LEFT JOIN FETCH d.parentDepartment
            LEFT JOIN FETCH e.manager
            """)
    List<Employee> findAllWithDetails();

    @Query("SELECT e.userId FROM Employee e WHERE e.userId IS NOT NULL")
    List<Long> findAllLinkedUserIds();

    @Query("SELECT e.id, e.fullName FROM Employee e WHERE e.id IN :ids")
    List<Object[]> findNamesByIds(@Param("ids") List<Long> ids);

    long countByEmploymentStatus(EmploymentStatus status);

    long countByUserIdIsNotNull();

    long countByManagerIsNotNull();
}

