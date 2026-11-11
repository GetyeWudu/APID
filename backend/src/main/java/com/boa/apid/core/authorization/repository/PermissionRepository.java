package com.boa.apid.core.authorization.repository;

import com.boa.apid.core.authorization.entity.Permission;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface PermissionRepository extends JpaRepository<Permission, Long> {
    Optional<Permission> findByCode(String code);
}

