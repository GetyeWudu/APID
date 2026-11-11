package com.boa.apid.core.authorization.repository;

import com.boa.apid.core.authorization.entity.Role;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface RoleRepository extends JpaRepository<Role, Long> {

    @Query("SELECT r FROM Role r WHERE LOWER(r.name) = LOWER(:name)")
    Optional<Role> findByNameIgnoreCase(@Param("name") String name);

    @Query("SELECT DISTINCT r FROM Role r LEFT JOIN FETCH r.permissions ORDER BY r.id ASC")
    List<Role> findAllWithPermissions();

    @Query("SELECT r FROM Role r LEFT JOIN FETCH r.permissions WHERE r.id = :id")
    Optional<Role> findByIdWithPermissions(@Param("id") Long id);

    @Query("SELECT COUNT(r) > 0 FROM Role r WHERE LOWER(r.name) = LOWER(:name) AND r.id <> :id")
    boolean existsByNameIgnoreCaseAndIdNot(@Param("name") String name, @Param("id") Long id);

    @Query("SELECT COUNT(ur) FROM UserRole ur WHERE ur.role.id = :roleId AND ur.active = true")
    long countActiveUsersByRoleId(@Param("roleId") Long roleId);
}
