package com.boa.apid.core.config.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.util.List;

public record UpdateSystemConfigsRequest(
        @NotEmpty(message = "At least one configuration update is required")
        @Valid
        List<ConfigUpdateEntry> updates
) {
    public record ConfigUpdateEntry(
            @NotBlank(message = "configKey is required")
            @Size(max = 100)
            String configKey,
            @NotNull(message = "configValue is required")
            @Size(max = 500)
            String configValue
    ) {}
}

