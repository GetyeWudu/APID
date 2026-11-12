package com.boa.apid.core.config.service;

import com.boa.apid.common.exception.BusinessException;
import com.boa.apid.common.exception.ResourceNotFoundException;
import com.boa.apid.core.audit.service.AuditService;
import com.boa.apid.core.audit.service.AuditService.AuditCommand;
import com.boa.apid.core.auth.security.ApidUserPrincipal;
import com.boa.apid.core.config.dto.*;
import com.boa.apid.core.config.entity.ConfigValueType;
import com.boa.apid.core.config.entity.FiscalQuarter;
import com.boa.apid.core.config.entity.SystemConfig;
import com.boa.apid.core.config.repository.FiscalQuarterRepository;
import com.boa.apid.core.config.repository.SystemConfigRepository;
import jakarta.persistence.EntityManager;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.*;

@Service
public class CoreConfigService {

    private static final String MODULE = "CORE_CONFIG";
    private static final long QUARTER_ADVISORY_LOCK_KEY = 400401L;

    private final FiscalQuarterRepository fiscalQuarterRepository;
    private final SystemConfigRepository systemConfigRepository;
    private final ConfigCacheStore configCacheStore;
    private final List<QuarterUsageChecker> quarterUsageCheckers;
    private final AuditService auditService;
    private final ApplicationEventPublisher eventPublisher;
    private final EntityManager entityManager;

    public CoreConfigService(
            FiscalQuarterRepository fiscalQuarterRepository,
            SystemConfigRepository systemConfigRepository,
            ConfigCacheStore configCacheStore,
            List<QuarterUsageChecker> quarterUsageCheckers,
            AuditService auditService,
            ApplicationEventPublisher eventPublisher,
            EntityManager entityManager
    ) {
        this.fiscalQuarterRepository = fiscalQuarterRepository;
        this.systemConfigRepository = systemConfigRepository;
        this.configCacheStore = configCacheStore;
        this.quarterUsageCheckers = quarterUsageCheckers != null ? quarterUsageCheckers : List.of();
        this.auditService = auditService;
        this.eventPublisher = eventPublisher;
        this.entityManager = entityManager;
    }

    @Transactional(readOnly = true)
    public ActiveConfigResponseDto getActiveConfigSnapshot() {
        ActiveCycleDto activeQuarter = configCacheStore.getActiveCycleCached();
        PublicConfigDto publicConfig = configCacheStore.getPublicConfigCached();
        String calendarQuarterLabel = fiscalQuarterRepository.findContainingDate(LocalDate.now())
                .stream()
                .findFirst()
                .map(FiscalQuarter::getLabel)
                .orElse(null);

        return new ActiveConfigResponseDto(activeQuarter, calendarQuarterLabel, publicConfig);
    }

    @Transactional(readOnly = true)
    public ActiveCycleDto getActiveQuarter() {
        return configCacheStore.getActiveCycleCached();
    }

    @Transactional(readOnly = true)
    public PublicConfigDto getPublicConfig() {
        return configCacheStore.getPublicConfigCached();
    }

    @Transactional(readOnly = true)
    public int getDefaultMaxTraineesPerTrainer() {
        return systemConfigRepository.findById("mentoring.default_max_trainees_per_trainer")
                .map(c -> Integer.parseInt(c.getConfigValue().trim()))
                .orElse(3);
    }

    @Transactional(readOnly = true)
    public AdminConfigViewDto getAdminConfigView() {
        List<SystemConfigItemDto> configs = systemConfigRepository.findAllByOrderByConfigKeyAsc().stream()
                .map(SystemConfigItemDto::from)
                .toList();
        List<FiscalQuarterDto> quarters = listAllQuarters();
        return new AdminConfigViewDto(configs, quarters);
    }

    @Transactional(readOnly = true)
    public List<FiscalQuarterDto> listAllQuarters() {
        return fiscalQuarterRepository.findAllByOrderByStartDateDesc().stream()
                .map(fq -> FiscalQuarterDto.from(fq, isQuarterReferenced(fq)))
                .toList();
    }

    @Transactional(readOnly = true)
    public FiscalQuarterDto getFiscalQuarterById(Long id) {
        FiscalQuarter fq = fiscalQuarterRepository.findById(id)
                .orElseThrow(() -> new com.boa.apid.common.exception.ResourceNotFoundException(
                        "Fiscal quarter not found with id: " + id));
        return FiscalQuarterDto.from(fq, isQuarterReferenced(fq));
    }

    @Transactional
    public List<SystemConfigItemDto> updateConfigs(
            UpdateSystemConfigsRequest request,
            ApidUserPrincipal actor,
            String ipAddress,
            String userAgent
    ) {
        List<Map<String, Object>> diffList = new ArrayList<>();
        List<SystemConfig> updatedEntities = new ArrayList<>();

        for (UpdateSystemConfigsRequest.ConfigUpdateEntry entry : request.updates()) {
            String key = entry.configKey().trim();
            SystemConfig entity = systemConfigRepository.findById(key)
                    .orElseThrow(() -> new ResourceNotFoundException("Configuration key not found: " + key));

            String normalizedNew = validateAndNormalizeConfigValue(entity.getConfigKey(), entity.getValueType(), entry.configValue());
            String previous = entity.getConfigValue();

            if (!Objects.equals(previous, normalizedNew)) {
                entity.setConfigValue(normalizedNew);
                entity.setUpdatedByUserId(actor.getUserId());
                updatedEntities.add(systemConfigRepository.save(entity));
                diffList.add(Map.of(
                        "configKey", key,
                        "previousValue", previous,
                        "newValue", normalizedNew
                ));
            }
        }

        if (!diffList.isEmpty()) {
            auditService.record(new AuditCommand(
                    null,
                    actor.getUserId(),
                    actor.getUsername(),
                    null,
                    MODULE,
                    "SYSTEM_CONFIG_UPDATED",
                    "SUCCESS",
                    null,
                    "SYSTEM_CONFIG",
                    String.valueOf(diffList.size()),
                    Map.of("changes", diffList),
                    ipAddress,
                    userAgent
            ));
            eventPublisher.publishEvent(ConfigCacheInvalidationEvent.configsOnly());
        }

        return systemConfigRepository.findAllByOrderByConfigKeyAsc().stream()
                .map(SystemConfigItemDto::from)
                .toList();
    }

    @Transactional
    public FiscalQuarterDto createQuarter(
            CreateFiscalQuarterRequest request,
            ApidUserPrincipal actor,
            String ipAddress,
            String userAgent
    ) {
        acquireQuarterAdvisoryLock();

        String fiscalYear = request.fiscalYear().trim();
        Short quarterNum = request.quarter().shortValue();
        validateDateRangeAndOverlap(request.startDate(), request.endDate(), null);

        if (fiscalQuarterRepository.existsByFiscalYearIgnoreCaseAndQuarter(fiscalYear, quarterNum)) {
            throw new BusinessException("QUARTER_DUPLICATE",
                    "Fiscal quarter " + fiscalYear + " Q" + quarterNum + " already exists",
                    HttpStatus.CONFLICT);
        }

        FiscalQuarter fq = new FiscalQuarter();
        fq.setFiscalYear(fiscalYear);
        fq.setQuarter(quarterNum);
        fq.setLabel(request.label() != null && !request.label().isBlank()
                ? request.label().trim()
                : "FY " + fiscalYear + " · Q" + quarterNum);
        fq.setStartDate(request.startDate());
        fq.setEndDate(request.endDate());
        fq.setActive(false);
        fq.setLocked(false);

        FiscalQuarter saved = fiscalQuarterRepository.save(fq);

        auditService.record(new AuditCommand(
                null,
                actor.getUserId(),
                actor.getUsername(),
                null,
                MODULE,
                "FISCAL_QUARTER_CREATED",
                "SUCCESS",
                null,
                "FISCAL_QUARTER",
                String.valueOf(saved.getId()),
                Map.of(
                        "fiscalYear", saved.getFiscalYear(),
                        "quarter", saved.getQuarter(),
                        "label", saved.getLabel(),
                        "startDate", saved.getStartDate().toString(),
                        "endDate", saved.getEndDate().toString()
                ),
                ipAddress,
                userAgent
        ));

        if (request.activate()) {
            return activateQuarterInternal(saved, actor, ipAddress, userAgent);
        }

        eventPublisher.publishEvent(ConfigCacheInvalidationEvent.quartersOnly());
        return FiscalQuarterDto.from(saved, false);
    }

    @Transactional
    public FiscalQuarterDto updateQuarter(
            Long id,
            UpdateFiscalQuarterRequest request,
            ApidUserPrincipal actor,
            String ipAddress,
            String userAgent
    ) {
        acquireQuarterAdvisoryLock();

        FiscalQuarter fq = fiscalQuarterRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Fiscal quarter not found: " + id));

        boolean referenced = isQuarterReferenced(fq);
        if (fq.isLocked() || referenced) {
            throw new BusinessException("QUARTER_LOCKED",
                    "Cannot modify dates of fiscal quarter \"" + fq.getLabel() + "\" because it is locked or referenced by historical records",
                    HttpStatus.CONFLICT);
        }

        validateDateRangeAndOverlap(request.startDate(), request.endDate(), fq.getId());

        String prevLabel = fq.getLabel();
        LocalDate prevStart = fq.getStartDate();
        LocalDate prevEnd = fq.getEndDate();

        fq.setLabel(request.label().trim());
        fq.setStartDate(request.startDate());
        fq.setEndDate(request.endDate());
        FiscalQuarter saved = fiscalQuarterRepository.save(fq);

        auditService.record(new AuditCommand(
                null,
                actor.getUserId(),
                actor.getUsername(),
                null,
                MODULE,
                "FISCAL_QUARTER_UPDATED",
                "SUCCESS",
                null,
                "FISCAL_QUARTER",
                String.valueOf(saved.getId()),
                Map.of(
                        "previousLabel", prevLabel,
                        "newLabel", saved.getLabel(),
                        "previousStartDate", prevStart.toString(),
                        "newStartDate", saved.getStartDate().toString(),
                        "previousEndDate", prevEnd.toString(),
                        "newEndDate", saved.getEndDate().toString()
                ),
                ipAddress,
                userAgent
        ));

        eventPublisher.publishEvent(ConfigCacheInvalidationEvent.quartersOnly());
        return FiscalQuarterDto.from(saved, referenced);
    }

    @Transactional
    public FiscalQuarterDto activateQuarter(
            Long id,
            ApidUserPrincipal actor,
            String ipAddress,
            String userAgent
    ) {
        acquireQuarterAdvisoryLock();

        FiscalQuarter target = fiscalQuarterRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Fiscal quarter not found: " + id));

        return activateQuarterInternal(target, actor, ipAddress, userAgent);
    }

    private FiscalQuarterDto activateQuarterInternal(
            FiscalQuarter target,
            ApidUserPrincipal actor,
            String ipAddress,
            String userAgent
    ) {
        Optional<FiscalQuarter> previousActiveOpt = fiscalQuarterRepository.findByActiveTrue();
        Long previousId = previousActiveOpt.map(FiscalQuarter::getId).orElse(null);
        String previousLabel = previousActiveOpt.map(FiscalQuarter::getLabel).orElse("NONE");

        if (Objects.equals(previousId, target.getId())) {
            return FiscalQuarterDto.from(target, isQuarterReferenced(target));
        }

        if (previousActiveOpt.isPresent()) {
            FiscalQuarter prev = previousActiveOpt.get();
            prev.setActive(false);
            fiscalQuarterRepository.saveAndFlush(prev);
        }

        target.setActive(true);
        FiscalQuarter saved = fiscalQuarterRepository.saveAndFlush(target);

        Map<String, Object> auditDetails = new LinkedHashMap<>();
        auditDetails.put("previousActiveQuarterId", previousId);
        auditDetails.put("previousActiveQuarterLabel", previousLabel);
        auditDetails.put("newActiveQuarterId", saved.getId());
        auditDetails.put("newActiveQuarterLabel", saved.getLabel());

        auditService.record(new AuditCommand(
                null,
                actor.getUserId(),
                actor.getUsername(),
                null,
                MODULE,
                "FISCAL_QUARTER_ACTIVATED",
                "SUCCESS",
                null,
                "FISCAL_QUARTER",
                String.valueOf(saved.getId()),
                auditDetails,
                ipAddress,
                userAgent
        ));

        eventPublisher.publishEvent(ConfigCacheInvalidationEvent.both());
        return FiscalQuarterDto.from(saved, isQuarterReferenced(saved));
    }

    private void acquireQuarterAdvisoryLock() {
        entityManager.createNativeQuery("SELECT pg_advisory_xact_lock(:lockKey)")
                .setParameter("lockKey", QUARTER_ADVISORY_LOCK_KEY)
                .getSingleResult();
    }

    private void validateDateRangeAndOverlap(LocalDate startDate, LocalDate endDate, Long excludeId) {
        if (startDate == null || endDate == null || !endDate.isAfter(startDate)) {
            throw new BusinessException("INVALID_QUARTER_DATES",
                    "End date must be strictly after start date",
                    HttpStatus.BAD_REQUEST);
        }

        List<FiscalQuarter> overlapping = fiscalQuarterRepository.findOverlapping(startDate, endDate, excludeId);
        if (!overlapping.isEmpty()) {
            FiscalQuarter conflict = overlapping.get(0);
            throw new BusinessException("QUARTER_DATE_OVERLAP",
                    "Dates overlap with existing fiscal quarter \"" + conflict.getLabel()
                            + "\" (" + conflict.getStartDate() + " to " + conflict.getEndDate() + ")",
                    HttpStatus.CONFLICT);
        }
    }

    private boolean isQuarterReferenced(FiscalQuarter fq) {
        if (fq.isLocked()) {
            return true;
        }
        return quarterUsageCheckers.stream().anyMatch(checker -> checker.isQuarterReferenced(fq.getId()));
    }

    private String validateAndNormalizeConfigValue(String key, ConfigValueType type, String rawValue) {
        String trimmed = rawValue != null ? rawValue.trim() : "";
        if (trimmed.isEmpty()) {
            throw new BusinessException("INVALID_CONFIG_VALUE",
                    "Configuration value for \"" + key + "\" cannot be blank",
                    HttpStatus.BAD_REQUEST);
        }

        switch (type) {
            case INTEGER -> {
                int parsed;
                try {
                    parsed = Integer.parseInt(trimmed);
                } catch (NumberFormatException ex) {
                    throw new BusinessException("INVALID_CONFIG_VALUE",
                            "Configuration \"" + key + "\" requires an integer value",
                            HttpStatus.BAD_REQUEST);
                }
                validateIntegerBounds(key, parsed);
                return String.valueOf(parsed);
            }
            case DECIMAL -> {
                try {
                    BigDecimal bd = new BigDecimal(trimmed);
                    return bd.stripTrailingZeros().scale() < 0 ? bd.toPlainString() : trimmed;
                } catch (NumberFormatException ex) {
                    throw new BusinessException("INVALID_CONFIG_VALUE",
                            "Configuration \"" + key + "\" requires a numeric decimal value",
                            HttpStatus.BAD_REQUEST);
                }
            }
            case BOOLEAN -> {
                if (!trimmed.equalsIgnoreCase("true") && !trimmed.equalsIgnoreCase("false")) {
                    throw new BusinessException("INVALID_CONFIG_VALUE",
                            "Configuration \"" + key + "\" requires true or false",
                            HttpStatus.BAD_REQUEST);
                }
                return trimmed.toLowerCase(Locale.ROOT);
            }
            case STRING -> {
                return trimmed;
            }
        }
        return trimmed;
    }

    private void validateIntegerBounds(String key, int val) {
        if ("coaching.mandatory_cutoff_rounded".equals(key)) {
            if (val < 1 || val > 5) {
                throw new BusinessException("INVALID_CONFIG_VALUE",
                        "Mandatory coaching cutoff must be an integer between 1 and 5",
                        HttpStatus.BAD_REQUEST);
            }
            return;
        }
        if ("files.max_upload_mb".equals(key)) {
            if (val < 1 || val > 100) {
                throw new BusinessException("INVALID_CONFIG_VALUE",
                        "Maximum upload size must be between 1 and 100 MB",
                        HttpStatus.BAD_REQUEST);
            }
            return;
        }
        if ("mentoring.default_max_trainees_per_trainer".equals(key)) {
            if (val < 1 || val > 50) {
                throw new BusinessException("INVALID_CONFIG_VALUE",
                        "Default maximum trainees per trainer must be between 1 and 50",
                        HttpStatus.BAD_REQUEST);
            }
            return;
        }
        if ("coaching.missed_session_alert_threshold".equals(key)) {
            if (val < 1 || val > 30) {
                throw new BusinessException("INVALID_CONFIG_VALUE",
                        "Missed session alert threshold must be between 1 and 30",
                        HttpStatus.BAD_REQUEST);
            }
            return;
        }
        if ("coaching.inactivity_reminder_days".equals(key)) {
            if (val < 1 || val > 365) {
                throw new BusinessException("INVALID_CONFIG_VALUE",
                        "Inactivity reminder days must be between 1 and 365",
                        HttpStatus.BAD_REQUEST);
            }
            return;
        }
        if (val <= 0) {
            throw new BusinessException("INVALID_CONFIG_VALUE",
                    "Configuration \"" + key + "\" must be a positive integer",
                    HttpStatus.BAD_REQUEST);
        }
    }
}

