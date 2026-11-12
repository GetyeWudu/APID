package com.boa.apid.core.authorization.repository;

import com.boa.apid.core.authorization.entity.User;
import com.boa.apid.core.authorization.entity.UserStatus;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.Optional;

public interface UserRepository extends JpaRepository<User, Long>, JpaSpecificationExecutor<User> {

    @Query("SELECT u FROM User u WHERE LOWER(u.username) = LOWER(:username)")
    Optional<User> findByUsernameIgnoreCase(@Param("username") String username);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT u FROM User u WHERE LOWER(u.username) = LOWER(:username)")
    Optional<User> findByUsernameLowerForUpdate(@Param("username") String username);

    long countByStatus(UserStatus status);

    long countByLockedUntilAfter(Instant now);

    long countByMustChangePasswordTrue();

    @Query("""
            SELECT COUNT(DISTINCT u.id)
            FROM UserRole ur
            JOIN ur.user u
            JOIN ur.role r
            WHERE ur.active = true
              AND r.active = true
              AND r.name = 'Super Admin'
              AND u.status = com.boa.apid.core.authorization.entity.UserStatus.ACTIVE
            """)
    long countActiveSuperAdmins();
}

