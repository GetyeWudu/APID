package com.boa.apid.core.authorization.repository;

import com.boa.apid.core.authorization.entity.UserRole;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Set;

public interface UserRoleRepository extends JpaRepository<UserRole, Long> {

    @Query("""
            SELECT DISTINCT r.name
            FROM UserRole ur
            JOIN ur.role r
            WHERE ur.user.id = :userId
              AND ur.active = true
              AND r.active = true
            """)
    List<String> findActiveRoleNamesByUserId(@Param("userId") Long userId);

    @Query("""
            SELECT DISTINCT p.code
            FROM UserRole ur
            JOIN ur.role r
            JOIN r.permissions p
            WHERE ur.user.id = :userId
              AND ur.active = true
              AND r.active = true
            """)
    Set<String> findActivePermissionCodesByUserId(@Param("userId") Long userId);

    @Query("""
            SELECT ur
            FROM UserRole ur
            JOIN FETCH ur.role
            WHERE ur.user.id = :userId
              AND ur.active = true
            """)
    List<UserRole> findActiveByUserIdWithRole(@Param("userId") Long userId);

    @Query("""
            SELECT ur
            FROM UserRole ur
            JOIN FETCH ur.role
            WHERE ur.user.id IN :userIds
              AND ur.active = true
            """)
    List<UserRole> findActiveByUserIdsWithRole(@Param("userIds") List<Long> userIds);

    @Modifying
    @Query("DELETE FROM UserRole ur WHERE ur.user.id = :userId")
    int deleteAllForUser(@Param("userId") Long userId);
}
