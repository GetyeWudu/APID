package com.boa.apid.core.config.repository;

import com.boa.apid.core.config.entity.SystemConfig;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface SystemConfigRepository extends JpaRepository<SystemConfig, String> {

    List<SystemConfig> findAllByOrderByConfigKeyAsc();

    List<SystemConfig> findAllByPublicVisibleTrueOrderByConfigKeyAsc();
}

