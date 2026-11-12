package com.boa.apid.core.config.dto;

import com.boa.apid.core.config.entity.ConfigValueType;
import com.boa.apid.core.config.entity.SystemConfig;

import java.time.Instant;

public record SystemConfigItemDto(
        String configKey,
        String configValue,
        ConfigValueType valueType,
        String description,
        boolean publicVisible,
        Long updatedByUserId,
        Instant createdAt,
        Instant updatedAt
) {
    public static SystemConfigItemDto from(SystemConfig entity) {
        return new SystemConfigItemDto(
                entity.getConfigKey(),
                entity.getConfigValue(),
                entity.getValueType(),
                entity.getDescription(),
                entity.isPublicVisible(),
                entity.getUpdatedByUserId(),
                entity.getCreatedAt(),
                entity.getUpdatedAt()
        );
    }
}

