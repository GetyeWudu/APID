package com.boa.apid.core.scheduling.repository;

import com.boa.apid.core.scheduling.entity.ScheduleEvent;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface ScheduleEventRepository extends JpaRepository<ScheduleEvent, Long> {

    Optional<ScheduleEvent> findBySourceModuleAndSourceSessionId(String sourceModule, Long sourceSessionId);

    void deleteBySourceModuleAndSourceSessionId(String sourceModule, Long sourceSessionId);
}

