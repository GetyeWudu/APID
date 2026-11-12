package com.boa.apid.core.skills.service;

import com.boa.apid.common.exception.BusinessException;
import com.boa.apid.common.exception.ResourceNotFoundException;
import com.boa.apid.core.audit.service.AuditService;
import com.boa.apid.core.auth.security.ApidUserPrincipal;
import com.boa.apid.core.skills.dto.CreateSkillRequest;
import com.boa.apid.core.skills.dto.SkillDto;
import com.boa.apid.core.skills.dto.UpdateSkillRequest;
import com.boa.apid.core.skills.dto.UpdateSkillStatusRequest;
import com.boa.apid.core.skills.entity.Skill;
import com.boa.apid.core.skills.repository.SkillRepository;
import jakarta.persistence.criteria.Predicate;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;

@Service
public class SkillService {

    private static final String MODULE = "CORE_SKILLS";

    private final SkillRepository skillRepository;
    private final SkillCacheStore skillCacheStore;
    private final ApplicationEventPublisher eventPublisher;
    private final AuditService auditService;

    public SkillService(
            SkillRepository skillRepository,
            SkillCacheStore skillCacheStore,
            ApplicationEventPublisher eventPublisher,
            AuditService auditService
    ) {
        this.skillRepository = skillRepository;
        this.skillCacheStore = skillCacheStore;
        this.eventPublisher = eventPublisher;
        this.auditService = auditService;
    }

    @Transactional(readOnly = true)
    public List<SkillDto> listActiveSkills(String search, String category) {
        String normalizedSearch = normalizeBlank(search);
        String normalizedCategory = normalizeBlank(category);

        List<SkillDto> cached = skillCacheStore.getActiveSkillsCached();
        if (normalizedSearch == null && normalizedCategory == null) {
            return cached;
        }

        String searchLower = normalizedSearch == null ? null : normalizedSearch.toLowerCase(Locale.ROOT);
        String categoryLower = normalizedCategory == null ? null : normalizedCategory.toLowerCase(Locale.ROOT);

        return cached.stream()
                .filter(skill -> categoryLower == null
                        || (skill.getCategory() != null && skill.getCategory().toLowerCase(Locale.ROOT).equals(categoryLower)))
                .filter(skill -> searchLower == null || matchesSearch(skill, searchLower))
                .toList();
    }

    @Transactional(readOnly = true)
    public List<SkillDto> listAllSkillsAdmin(String search, String category, Boolean active) {
        String normalizedSearch = normalizeBlank(search);
        String normalizedCategory = normalizeBlank(category);

        Specification<Skill> spec = (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();
            if (active != null) {
                predicates.add(cb.equal(root.get("active"), active));
            }
            if (normalizedCategory != null) {
                predicates.add(cb.equal(cb.lower(root.get("category")), normalizedCategory.toLowerCase(Locale.ROOT)));
            }
            if (normalizedSearch != null) {
                String pattern = "%" + normalizedSearch.toLowerCase(Locale.ROOT) + "%";
                predicates.add(cb.or(
                        cb.like(cb.lower(root.get("name")), pattern),
                        cb.like(cb.lower(root.get("category")), pattern),
                        cb.like(cb.lower(cb.coalesce(root.get("description"), "")), pattern)
                ));
            }
            return cb.and(predicates.toArray(Predicate[]::new));
        };

        return skillRepository.findAll(spec, Sort.by(Sort.Direction.ASC, "name")).stream()
                .map(SkillDto::from)
                .toList();
    }

    @Transactional(readOnly = true)
    public SkillDto getSkillById(Long id) {
        Skill skill = skillRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Skill not found"));
        return SkillDto.from(skill);
    }

    @Transactional(readOnly = true)
    public SkillDto getActiveSkillById(Long id) {
        Skill skill = skillRepository.findByIdAndActiveTrue(id)
                .orElseThrow(() -> new ResourceNotFoundException("Active skill not found"));
        return SkillDto.from(skill);
    }

    @Transactional
    public SkillDto createSkill(CreateSkillRequest request, ApidUserPrincipal actor) {
        String name = request.name().trim();
        String category = request.category().trim();
        String description = normalizeBlank(request.description());

        if (skillRepository.existsByNameIgnoreCase(name)) {
            throw new BusinessException("SKILL_ALREADY_EXISTS", "A skill with this name already exists", HttpStatus.CONFLICT);
        }

        Skill skill = new Skill();
        skill.setName(name);
        skill.setCategory(category);
        skill.setDescription(description);
        skill.setActive(true);

        Skill saved = skillRepository.save(skill);
        eventPublisher.publishEvent(new SkillCacheInvalidationEvent());

        auditService.record(new AuditService.AuditCommand(
                null,
                actor.getUserId(),
                actor.getUsername(),
                null,
                MODULE,
                "SKILL_CREATE",
                "SUCCESS",
                null,
                "SKILL",
                String.valueOf(saved.getId()),
                Map.of("name", saved.getName(), "category", saved.getCategory()),
                null,
                null
        ));

        return SkillDto.from(saved);
    }

    @Transactional
    public SkillDto updateSkill(Long id, UpdateSkillRequest request, ApidUserPrincipal actor) {
        Skill skill = skillRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Skill not found"));

        String name = request.name().trim();
        String category = request.category().trim();
        String description = normalizeBlank(request.description());

        if (skillRepository.existsByNameIgnoreCaseAndIdNot(name, id)) {
            throw new BusinessException("SKILL_ALREADY_EXISTS", "A skill with this name already exists", HttpStatus.CONFLICT);
        }

        skill.setName(name);
        skill.setCategory(category);
        skill.setDescription(description);

        Skill saved = skillRepository.save(skill);
        eventPublisher.publishEvent(new SkillCacheInvalidationEvent());

        auditService.record(new AuditService.AuditCommand(
                null,
                actor.getUserId(),
                actor.getUsername(),
                null,
                MODULE,
                "SKILL_UPDATE",
                "SUCCESS",
                null,
                "SKILL",
                String.valueOf(saved.getId()),
                Map.of("name", saved.getName(), "category", saved.getCategory()),
                null,
                null
        ));

        return SkillDto.from(saved);
    }

    @Transactional
    public SkillDto updateSkillStatus(Long id, UpdateSkillStatusRequest request, ApidUserPrincipal actor) {
        Skill skill = skillRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Skill not found"));

        boolean targetActive = Boolean.TRUE.equals(request.active());
        skill.setActive(targetActive);

        Skill saved = skillRepository.save(skill);
        eventPublisher.publishEvent(new SkillCacheInvalidationEvent());

        auditService.record(new AuditService.AuditCommand(
                null,
                actor.getUserId(),
                actor.getUsername(),
                null,
                MODULE,
                targetActive ? "SKILL_ACTIVATE" : "SKILL_DEACTIVATE",
                "SUCCESS",
                null,
                "SKILL",
                String.valueOf(saved.getId()),
                Map.of("name", saved.getName(), "active", saved.isActive()),
                null,
                null
        ));

        return SkillDto.from(saved);
    }

    private boolean matchesSearch(SkillDto skill, String searchLower) {
        return containsLower(skill.getName(), searchLower)
                || containsLower(skill.getCategory(), searchLower)
                || containsLower(skill.getDescription(), searchLower);
    }

    private boolean containsLower(String value, String needleLower) {
        return value != null && value.toLowerCase(Locale.ROOT).contains(needleLower);
    }

    private String normalizeBlank(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }
}

