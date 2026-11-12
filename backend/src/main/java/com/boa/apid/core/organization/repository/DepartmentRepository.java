package com.boa.apid.core.organization.repository;

import com.boa.apid.core.organization.entity.Department;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface DepartmentRepository extends JpaRepository<Department, Long> {

    @EntityGraph(attributePaths = {"parentDepartment"})
    List<Department> findAllByOrderByNameAsc();

    @EntityGraph(attributePaths = {"parentDepartment"})
    List<Department> findAllByActiveTrueOrderByNameAsc();

    @Query("SELECT d FROM Department d WHERE LOWER(d.code) = LOWER(:code)")
    Optional<Department> findByCodeIgnoreCase(@Param("code") String code);

    @Query("SELECT CASE WHEN COUNT(d) > 0 THEN true ELSE false END FROM Department d WHERE LOWER(d.code) = LOWER(:code) AND d.id <> :id")
    boolean existsByCodeIgnoreCaseAndIdNot(@Param("code") String code, @Param("id") Long id);

    @Query("SELECT CASE WHEN COUNT(d) > 0 THEN true ELSE false END FROM Department d WHERE LOWER(d.code) = LOWER(:code)")
    boolean existsByCodeIgnoreCase(@Param("code") String code);

    @Query("SELECT d FROM Department d WHERE LOWER(d.name) = LOWER(:name) AND d.parentDepartment IS NULL")
    Optional<Department> findRootByNameIgnoreCase(@Param("name") String name);

    @Query("SELECT d FROM Department d WHERE LOWER(d.name) = LOWER(:name) AND d.parentDepartment.id = :parentId")
    Optional<Department> findChildByNameAndParentIdIgnoreCase(@Param("name") String name, @Param("parentId") Long parentId);

    long countByActiveTrue();
}

