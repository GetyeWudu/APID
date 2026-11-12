package com.boa.apid.core.skills.service;

import com.boa.apid.core.skills.dto.SkillDto;
import com.boa.apid.core.skills.repository.SkillRepository;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

import java.util.ArrayList;

@Component
public class SkillCacheStore {

    private final SkillRepository skillRepository;

    public SkillCacheStore(SkillRepository skillRepository) {
        this.skillRepository = skillRepository;
    }

    @Cacheable(cacheNames = "skills_catalog", key = "'active'")
    public ArrayList<SkillDto> getActiveSkillsCached() {
        return skillRepository.findAllByActiveTrueOrderByNameAsc().stream()
                .map(SkillDto::from)
                .collect(java.util.stream.Collectors.toCollection(ArrayList::new));
    }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT, fallbackExecution = true)
    @CacheEvict(cacheNames = "skills_catalog", allEntries = true)
    public void onSkillChanged(SkillCacheInvalidationEvent event) {
        // Eviction handled via @CacheEvict after transaction commits.
    }
}

