package com.boa.apid.core.skills.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record CreateSkillRequest(
        @NotBlank(message = "Skill name is required")
        @Size(max = 150, message = "Skill name must not exceed 150 characters")
        String name,

        @NotBlank(message = "Category is required")
        @Size(max = 100, message = "Category must not exceed 100 characters")
        String category,

        @Size(max = 500, message = "Description must not exceed 500 characters")
        String description
) {}

